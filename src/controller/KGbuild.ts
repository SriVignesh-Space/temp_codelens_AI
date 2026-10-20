import { readFile } from "node:fs/promises";
import path from "node:path";
import { NODE_TYPES, PATTERNS } from "../config/schema.js";
import { ManagedTransaction } from "neo4j-driver";
import { getNeo4jSession } from "../config/neo4j_config.js";

/**
 * --- Types ---
 */
interface IRLocation {
    file: string;
    start: { line: number; column: number };
    end: { line: number; column: number };
}

interface IRItem {
    id: string;
    location: IRLocation;
    [key: string]: any;
}

interface IRFile {
    path: string;
    language?: string;
    imports?: IRItem[];
    exports?: IRItem[];
    functions?: IRItem[];
    classes?: IRItem[];
    calls?: IRItem[];
    routes?: IRItem[];
    components?: IRItem[];
    hooks?: IRItem[];
    mongooseSchemas?: IRItem[];
    mongooseModels?: IRItem[];
}

interface IRPayload {
    projectId: string;
    generatedAt?: string;
    files: IRFile[];
}

interface GraphNode {
    label: string;
    id: string;
    props: Record<string, any>;
}

interface GraphEdge {
    type: string;
    fromLabel: string;
    fromId: string;
    toLabel: string;
    toId: string;
}

interface IngestStats {
    projectId: string;
    nodes: Record<string, number>;
    nodesTotal: number;
    relationships: Record<string, number>;
    relationshipsTotal: number;
    unresolved: { imports: number; exports: number; calls: number; models: number };
    ignoredProperties: string[];
}

/**
 * --- Constants ---
 */
const DEFAULT_BATCH_SIZE = 500;
const SCRIPT_EXTENSIONS = [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"];

/**
 * --- KGBuilder Class ---
 * Handles the transformation from IR JSON to a Neo4j Knowledge Graph.
 */
export class KGBuilder {
    private projectId: string;
    private payload: IRPayload;
    private nodesByLabel: Map<string, GraphNode[]> = new Map();
    private edges: GraphEdge[] = [];
    private stats: IngestStats;
    private ignored = new Set<string>();

    // Resolution Indexes
    private functionsByName = new Map<string, string[]>();
    private schemasByName = new Map<string, string[]>();
    private filePaths = new Set<string>();
    private localNameMap = new Map<string, Map<string, string>>(); // fileId -> localName -> targetId/importedName

    constructor(projectId: string, payload: IRPayload) {
        this.projectId = projectId;
        this.payload = payload;
        this.stats = {
            projectId,
            nodes: {},
            nodesTotal: 0,
            relationships: {},
            relationshipsTotal: 0,
            unresolved: { imports: 0, exports: 0, calls: 0, models: 0 },
            ignoredProperties: [],
        };
        this.filePaths = new Set(payload.files.map((f) => f.path));
    }

    public async build() {
        this.buildProjectNode();
        this.pass1NodesAndContainment();
        this.pass2Resolution();

        this.stats.ignoredProperties = [...this.ignored].sort();
        return { nodesByLabel: this.nodesByLabel, edges: this.edges, stats: this.stats };
    }

    private buildProjectNode() {
        this.addNode("Project", this.projectId, {
            id: this.projectId,
            generatedAt: this.payload.generatedAt ?? new Date().toISOString(),
        });
    }

    private pass1NodesAndContainment() {
        for (const file of this.payload.files) {
            const fileId = this.sourceFileId(file.path);
            this.addNode("SourceFile", fileId, {
                id: fileId,
                path: file.path,
                language: file.language ?? null,
            });
            this.addEdge("CONTAINS_FILE", "Project", this.projectId, "SourceFile", fileId);

            const fileFunctions = new Map<string, string>();
            const fileSchemas = new Map<string, string>();

            // 1. Imports
            for (const item of file.imports ?? []) {
                this.addNode("Import", item.id, { ...this.startOf(item.location), id: item.id, source: item.source, importKind: item.importKind, importedName: item.importedName, localName: item.localName });
                this.addEdge("CONTAINS_IMPORT", "SourceFile", fileId, "Import", item.id);

                if (item.localName) {
                    const fileMap = this.localNameMap.get(fileId) ?? new Map();
                    fileMap.set(item.localName, item.importedName ?? item.id);
                    this.localNameMap.set(fileId, fileMap);
                }
            }

            // 2. Exports
            for (const item of file.exports ?? []) {
                this.addNode("Export", item.id, { ...this.startOf(item.location), id: item.id, exportKind: item.exportKind, name: item.name });
                this.addEdge("CONTAINS_EXPORT", "SourceFile", fileId, "Export", item.id);
            }

            // 3. Functions
            for (const item of file.functions ?? []) {
                this.addNode("Function", item.id, {
                    ...this.spanOf(item.location),
                    id: item.id,
                    name: item.name,
                    async: item.async ?? false,
                    generator: item.generator ?? false,
                    returnType: item.returnType
                });
                this.addEdge("CONTAINS_FUNCTION", "SourceFile", fileId, "Function", item.id);

                if (item.name) {
                    const fileMap = this.localNameMap.get(fileId) ?? new Map();
                    fileMap.set(item.name, item.id);
                    this.localNameMap.set(fileId, fileMap);

                    fileFunctions.set(item.name, item.id);
                    const globals = this.functionsByName.get(item.name) ?? [];
                    globals.push(item.id);
                    this.functionsByName.set(item.name, globals);
                }

                // Resolve parameters into separate nodes
                if (item.parameters) {
                    item.parameters.forEach((param: any, idx: number) => {
                        const paramId = `${item.id}_param_${idx}`;
                        this.addNode("Parameter", paramId, { id: paramId, name: param.name, type: param.type });
                        this.addEdge("HAS_PARAMETER", "Function", item.id, "Parameter", paramId);
                    });
                }
            }

            // 4. Classes
            for (const item of file.classes ?? []) {
                this.addNode("Class", item.id, { ...this.startOf(item.location), id: item.id, name: item.name, abstract: item.abstract ?? false });
                this.addEdge("CONTAINS_CLASS", "SourceFile", fileId, "Class", item.id);

                // Resolve methods as Functions
                if (item.methods) {
                    item.methods.forEach((method: any, idx: number) => {
                        const methodId = `${item.id}_method_${idx}`;
                        this.addNode("Function", methodId, {
                            ...this.spanOf(method.location),
                            id: methodId,
                            name: method.name,
                            isMethod: true
                        });
                        this.addEdge("DEFINES_METHOD", "Class", item.id, "Function", methodId);
                        this.addEdge("CONTAINS_FUNCTION", "SourceFile", fileId, "Function", methodId);

                        if (method.name) {
                            const globals = this.functionsByName.get(method.name) ?? [];
                            globals.push(methodId);
                            this.functionsByName.set(method.name, globals);
                        }
                    });
                }
            }

            // 5. Calls
            for (const item of file.calls ?? []) {
                this.addNode("Call", item.id, { ...this.spanOf(item.location), id: item.id, callee: item.callee, argumentCount: item.argumentCount ?? 0 });
                this.addEdge("CONTAINS_CALL", "SourceFile", fileId, "Call", item.id);
            }

            // 6. Routes
            for (const item of file.routes ?? []) {
                this.addNode("Route", item.id, { ...this.startOf(item.location), id: item.id, method: item.method, path: item.path, router: item.router });
                this.addEdge("CONTAINS_ROUTE", "SourceFile", fileId, "Route", item.id);

                if (item.middleware) {
                    item.middleware.forEach((mw: any, idx: number) => {
                        const mwId = `${item.id}_mw_${idx}`;
                        this.addNode("Middleware", mwId, { id: mwId, name: mw.name });
                        this.addEdge("USES_MIDDLEWARE", "Route", item.id, "Middleware", mwId);
                    });
                }
            }

            // 7. Components & Hooks
            for (const item of file.components ?? []) {
                this.addNode("Component", item.id, { ...this.startOf(item.location), id: item.id, name: item.name, style: item.style });
                this.addEdge("CONTAINS_COMPONENT", "SourceFile", fileId, "Component", item.id);
            }
            for (const item of file.hooks ?? []) {
                this.addNode("Hook", item.id, { ...this.startOf(item.location), id: item.id, name: item.name });
                this.addEdge("CONTAINS_HOOK", "SourceFile", fileId, "Hook", item.id);
            }

            // 8. Mongoose
            for (const item of file.mongooseSchemas ?? []) {
                this.addNode("MongooseSchema", item.id, { ...this.startOf(item.location), id: item.id, name: item.name });
                this.addEdge("CONTAINS_SCHEMA", "SourceFile", fileId, "MongooseSchema", item.id);

                if (item.fields) {
                    Object.entries(item.fields).forEach(([fieldName, fieldVal]: [string, any]) => {
                        const fieldId = `${item.id}_field_${fieldName}`;
                        this.addNode("Field", fieldId, { id: fieldId, name: fieldName, type: fieldVal.type });
                        this.addEdge("HAS_FIELD", "MongooseSchema", item.id, "Field", fieldId);
                    });
                }

                if (item.name) {
                    fileSchemas.set(item.name, item.id);
                    const globals = this.schemasByName.get(item.name) ?? [];
                    globals.push(item.id);
                    this.schemasByName.set(item.name, globals);
                }
            }
            for (const item of file.mongooseModels ?? []) {
                this.addNode("MongooseModel", item.id, { ...this.startOf(item.location), id: item.id, name: item.name, schemaName: item.schema, orm: item.orm });
                this.addEdge("CONTAINS_MODEL", "SourceFile", fileId, "MongooseModel", item.id);
            }
        }
    }

    private pass2Resolution() {
        for (const file of this.payload.files) {
            const fileId = this.sourceFileId(file.path);

            // Import Resolution
            for (const item of file.imports ?? []) {
                const target = this.resolveImportPath(file.path, item.source);
                if (target) {
                    this.addEdge("IMPORTS_FILE", "SourceFile", fileId, "SourceFile", this.sourceFileId(target));
                } else if (item.source.startsWith(".")) {
                    this.stats.unresolved.imports++;
                }
            }

            // Export Resolution
            for (const item of file.exports ?? []) {
                if (!item.name) continue;

                const localMap = this.localNameMap.get(fileId);
                const targetId = localMap?.get(item.name);

                let targets: string[] = [];
                if (targetId) {
                    targets = [targetId];
                } else {
                    targets = this.functionsByName.get(item.name) ?? [];
                }

                if (this.resolveAndLink("Export", item.id, "Function", "DECLARES_EXPORT", targets)) {
                    // success
                } else {
                    this.stats.unresolved.exports++;
                }
            }

            // Call Resolution (Best Effort)
            for (const item of file.calls ?? []) {
                const callee = item.callee;
                if (!callee) continue;

                let targetName = callee;
                if (callee.includes(".")) {
                    // Handle obj.method() -> extract 'method'
                    const parts = callee.split(".");
                    targetName = parts[parts.length - 1];
                }

                const localMap = this.localNameMap.get(fileId);
                const localTargetId = localMap?.get(targetName);

                let targets: string[] = [];
                if (localTargetId) {
                    targets = [localTargetId];
                } else {
                    targets = this.functionsByName.get(targetName) ?? [];
                }

                if (this.resolveAndLink("Call", item.id, "Function", "CALLS_FUNCTION", targets)) {
                    // success
                } else {
                    this.stats.unresolved.calls++;
                }
            }

            // Mongoose Resolution
            for (const item of file.mongooseModels ?? []) {
                if (!item.schema) continue;

                const localMap = this.localNameMap.get(fileId);
                const localTargetId = localMap?.get(item.schema);

                let targets: string[] = [];
                if (localTargetId) {
                    targets = [localTargetId];
                } else {
                    targets = this.schemasByName.get(item.schema) ?? [];
                }

                if (this.resolveAndLink("MongooseModel", item.id, "MongooseSchema","USES_SCHEMA", targets)) {
                    // success
                } else {
                    this.stats.unresolved.models++;
                }
            }
        }
    }

    private addNode(label: string, id: string, props: Record<string, any>) {
        const cleanProps = { ...props, projectId: this.projectId, id };
        if (!this.nodesByLabel.has(label)) this.nodesByLabel.set(label, []);
        this.nodesByLabel.get(label)!.push({ label, id, props: cleanProps });
        this.stats.nodes[label] = (this.stats.nodes[label] ?? 0) + 1;
        this.stats.nodesTotal++;
    }

    private addEdge(type: string, fromLabel: string, fromId: string, toLabel: string, toId: string) {
        this.edges.push({ type, fromLabel, fromId, toLabel, toId });
        this.stats.relationships[type] = (this.stats.relationships[type] ?? 0) + 1;
        this.stats.relationshipsTotal++;
    }

    private sourceFileId(path: string) { return `file:${path}`; }
    private startOf(loc: IRLocation) { return { file: loc.file, startLine: loc.start.line, startColumn: loc.start.column }; }
    private spanOf(loc: IRLocation) { return { ...this.startOf(loc), endLine: loc.end.line, endColumn: loc.end.column }; }
    private uniqueMatch(ids?: string[]) { return (ids && ids.length === 1) ? ids[0] : null; }

    private resolveAndLink(fromLabel: string, fromId: string, targetLabel: string,  relType: string, targetIds?: string[]) {
        if (!targetIds || targetIds.length === 0) return false;
        targetIds.forEach(toId => this.addEdge(relType, fromLabel, fromId, targetLabel, toId));
        return true;
    }

    private resolveImportPath(fromFile: string, specifier: string) {
        if (!specifier.startsWith(".")) return null;

        // Basic Alias Resolution (Example: @/ -> root)
        let normalizedSpecifier = specifier;
        if (specifier.startsWith("@/")) {
            // In a real impl, we would resolve this against a root directory
            normalizedSpecifier = specifier.replace("@/", "./");
        }

        const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), normalizedSpecifier));
        const candidates = [base, ...SCRIPT_EXTENSIONS.flatMap(ext => [`${base}${ext}`, path.posix.join(base, `index${ext}`)])];

        for (const candidate of candidates) {
            if (this.filePaths.has(candidate)) return candidate;
        }
        return null;
    }
}

/**
 * --- KGWriter ---
 * Writes the Graph representation to Neo4j.
 */
export async function convertJsonToKg(projectId: string, options: { reset?: boolean, batchSize?: number } = {}) {
    const irFile = path.resolve("temp_ir_store", `${projectId}.json`);
    const raw = await readFile(irFile, "utf-8");
    const parsed = JSON.parse(raw);
    const payload: IRPayload = parsed.data;
    const builder = new KGBuilder(projectId, payload);
    const { nodesByLabel, edges, stats } = await builder.build();
    const session = await getNeo4jSession();

    try {
        // 1. Schema Modifications
        // Use separate session.run calls. Each call creates its own implicit transaction.
        await session.run(`CREATE INDEX project_id_idx IF NOT EXISTS FOR (p:Project) ON (p.projectId)`);
        await session.run(`CREATE INDEX file_id_idx IF NOT EXISTS FOR (f:SourceFile) ON (f.id)`);
        await session.run(`CREATE INDEX func_id_idx IF NOT EXISTS FOR (fn:Function) ON (fn.id)`);
        await session.run(`CREATE INDEX func_pid_idx IF NOT EXISTS FOR (fn:Function) ON (fn.projectId)`);
        await session.run(`CREATE INDEX call_id_idx IF NOT EXISTS FOR (c:Call) ON (c.id)`);

        // 2. Data Reset
        // Use executeWrite to ensure consistency
        await session.executeWrite(async (tx) => {
            if (options.reset ?? true) {
                await tx.run(`MATCH (n { projectId: $projectId }) DETACH DELETE n`, { projectId });
            }
        });

        // 3. Nodes Ingestion
        await session.executeWrite(async (tx) => {
            for (const [label, nodes] of nodesByLabel) {
                for (const batch of chunk(nodes, options.batchSize ?? DEFAULT_BATCH_SIZE)) {
                    await tx.run(`
                        UNWIND $rows AS row
                        MERGE (n:\`${label}\` { id: row.id, projectId: $projectId })
                        SET n += row.props
                    `, { rows: batch, projectId });
                }
            }
        });

        // 4. Relationships Ingestion
        await session.executeWrite(async (tx) => {
            const edgesByPattern = new Map<string, GraphEdge[]>();
            for (const edge of edges) {
                const key = `${edge.fromLabel}|${edge.type}|${edge.toLabel}`;
                if (!edgesByPattern.has(key)) edgesByPattern.set(key, []);
                edgesByPattern.get(key)!.push(edge);
            }

            for (const [pattern, group] of edgesByPattern) {
                const [fromLabel, relType, toLabel] = pattern.split("|");
                for (const batch of chunk(group, options.batchSize ?? DEFAULT_BATCH_SIZE)) {
                    const rows = batch.map(e => ({ from: e.fromId, to: e.toId }));
                    await tx.run(`
                        UNWIND $rows AS row
                        MATCH (a:\`${fromLabel}\` { id: row.from, projectId: $projectId })
                        MATCH (b:\`${toLabel}\` { id: row.to, projectId: $projectId })
                        MERGE (a)-[r:\`${relType}\`]->(b)
                        SET r.projectId = $projectId
                    `, { rows, projectId });
                }
            }
        });
    } finally {
        await session.close();
    }

    return stats;
}

function chunk<T>(items: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
    return result;
}
