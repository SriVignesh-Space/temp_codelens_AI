import { getNeo4jSession, closeNeo4jDriver } from "../config/neo4j_config.js";
import path from "path";

const IR_STORE_DIR = path.resolve("temp_ir_store");

export async function convertIrToKg(projectId: string): Promise<void> {
  const jsonPath = path.join(IR_STORE_DIR, `${projectId}.json`);

  // Read the IR JSON file
  const irData = await import("fs/promises")
    .then(fs => fs.readFile(jsonPath, "utf-8"))
    .then(content => JSON.parse(content));

  const session = await getNeo4jSession();

  try {
    // Build the knowledge graph from the IR data
    const result = await session.executeWrite(async tx => {
      // Create or update Project node
      tx.run(
        `MERGE (p:Project {projectId: $pid})
         ON CREATE SET p.generatedAt = $generatedAt`,
        { pid: projectId, generatedAt: irData.generatedAt || new Date().toISOString() }
      );

      // Process each file
      for (const file of irData.files || []) {
        // Create SourceFile node
        await tx.run(
          `MERGE (sf:SourceFile {id: $fid, projectId: $pid})
           ON CREATE SET sf.path = $path, sf.language = $lang`,
          {
            fid: file.id,
            pid: projectId,
            path: file.path,
            lang: file.language,
          }
        );

        // CONTAINS_FILE relationship
        await tx.run(
          `MATCH (p:Project {projectId: $pid}), (sf:SourceFile {id: $fid})
           MERGE (p)-[r:CONTAINS_FILE]->(sf)
           ON CREATE SET r.createdAt = datetime()`,
          { pid: projectId, fid: file.id }
        );

        // Process imports
        for (const imp of file.imports || []) {
          const importId = imp.id;
          await tx.run(
            `MERGE (imp:Import {id: $impId})
             ON CREATE SET imp.kind = $kind, imp.source = $source,
               imp.importKind = $importKind, imp.importedName = $importedName`,
            {
              impId: importId,
              kind: "Import",
              source: imp.source,
              importKind: imp.importKind,
              importedName: imp.importedName || null,
            }
          );
          await tx.run(
            `MATCH (sf:SourceFile {id: $fid}), (imp:Import {id: $impId})
             MERGE (sf)-[r:IMPORTS_FILE]->(imp)
             ON CREATE SET r.createdAt = datetime()`,
            { fid: file.id, impId: importId }
          );
        }

        // Process exports
        for (const exp of file.exports || []) {
          const exportId = exp.id;
          await tx.run(
            `MERGE (exp:Export {id: $expId})
             ON CREATE SET exp.kind = $kind, exp.name = $name,
               exp.exportKind = $exportKind`,
            {
              expId: exportId,
              kind: "Export",
              name: exp.name || null,
              exportKind: exp.exportKind || null,
            }
          );
          await tx.run(
            `MATCH (sf:SourceFile {id: $fid}), (exp:Export {id: $expId})
             MERGE (sf)-[r:DECLARES_EXPORT]->(exp)
             ON CREATE SET r.createdAt = datetime()`,
            { fid: file.id, expId: exportId }
          );
        }

        // Process functions
        for (const fn of file.functions || []) {
          const funcId = fn.id;
          await tx.run(
            `MERGE (func:Function {id: $funcId, projectId: $pid})
             ON CREATE SET func.name = $name, func.async = $async,
               func.generator = $generator, func.parametersJson = $parametersJson,
               func.returnType = $returnType`,
            {
              funcId: funcId,
              pid: projectId,
              name: fn.name || null,
              async: fn.async ?? false,
              generator: fn.generator ?? false,
              parametersJson: fn.parametersJson || null,
              returnType: fn.returnType || null,
            }
          );
          await tx.run(
            `MATCH (sf:SourceFile {id: $fid}), (func:Function {id: $funcId})
             MERGE (sf)-[r:CONTAINS_FUNCTION]->(func)
             ON CREATE SET r.createdAt = datetime()`,
            { fid: file.id, funcId: funcId }
          );
        }

        // Process classes
        for (const cls of file.classes || []) {
          const classId = cls.id;
          await tx.run(
            `MERGE (cls:Class {id: $classId, projectId: $pid})
             ON CREATE SET cls.name = $name, cls.abstract = $abstract,
               cls.methodsJson = $methodsJson`,
            {
              classId: classId,
              pid: projectId,
              name: cls.name || null,
              abstract: cls.abstract ?? false,
              methodsJson: cls.methodsJson || null,
            }
          );
          await tx.run(
            `MATCH (sf:SourceFile {id: $fid}), (cls:Class {id: $classId})
             MERGE (sf)-[r:CONTAINS_CLASS]->(cls)
             ON CREATE SET r.createdAt = datetime()`,
            { fid: file.id, classId: classId }
          );
        }

        // Process calls
        for (const call of file.calls || []) {
          const callId = call.id;
          await tx.run(
            `MERGE (c:Call {id: $callId})
             ON CREATE SET c.kind = $kind, c.callee = $callee,
               c.argumentCount = $argumentCount`,
            {
              callId: callId,
              kind: "Call",
              callee: call.callee || null,
              argumentCount: call.argumentCount ?? 0,
            }
          );
          await tx.run(
            `MATCH (sf:SourceFile {id: $fid}), (c:Call {id: $callId})
             MERGE (sf)-[r:CONTAINS_CALL]->(c)
             ON CREATE SET r.createdAt = datetime()`,
            { fid: file.id, callId: callId }
          );
        }

        // Process routes
        for (const route of file.routes || []) {
          const routeId = route.id;
          await tx.run(
            `MERGE (rt:Route {id: $routeId, projectId: $pid})
             ON CREATE SET rt.method = $method, rt.path = $path,
               rt.router = $router, rt.handlerId = $handlerId,
               rt.middlewareJson = $middlewareJson`,
            {
              routeId: routeId,
              pid: projectId,
              method: route.method || null,
              path: route.path || null,
              router: route.router || null,
              handlerId: route.handlerId || null,
              middlewareJson: route.middlewareJson || null,
            }
          );
          await tx.run(
            `MATCH (sf:SourceFile {id: $fid}), (rt:Route {id: $routeId})
             MERGE (sf)-[r:CONTAINS_ROUTE]->(rt)
             ON CREATE SET r.createdAt = datetime()`,
            { fid: file.id, routeId: routeId }
          );
          // HANDLES relationship: Route -> Function
          if (route.handler) {
            const [, handlerFile, handlerLine] = route.handler.split(":");
            const handlerId = route.handler;
            await tx.run(
              `MATCH (rt:Route {id: $routeId}), (func:Function {id: $funcId})
               MERGE (rt)-[r:HANDLES]->(func)
               ON CREATE SET r.createdAt = datetime()`,
              { routeId: routeId, funcId: handlerId }
            );
          }
        }

        // Process components
        for (const comp of file.components || []) {
          const compId = comp.id;
          await tx.run(
            `MERGE (comp:Component {id: $compId, projectId: $pid})
             ON CREATE SET comp.name = $name, comp.style = $style`,
            {
              compId: compId,
              pid: projectId,
              name: comp.name || null,
              style: comp.style || null,
            }
          );
          await tx.run(
            `MATCH (sf:SourceFile {id: $fid}), (comp:Component {id: $compId})
             MERGE (sf)-[r:CONTAINS_COMPONENT]->(comp)
             ON CREATE SET r.createdAt = datetime()`,
            { fid: file.id, compId: compId }
          );
        }

        // Process hooks
        for (const hook of file.hooks || []) {
          const hookId = hook.id;
          await tx.run(
            `MERGE (h:Hook {id: $hookId, projectId: $pid})
             ON CREATE SET h.name = $name`,
            {
              hookId: hookId,
              pid: projectId,
              name: hook.name || null,
            }
          );
          await tx.run(
            `MATCH (sf:SourceFile {id: $fid}), (h:Hook {id: $hookId})
             MERGE (sf)-[r:CONTAINS_HOOK]->(h)
             ON CREATE SET r.createdAt = datetime()`,
            { fid: file.id, hookId: hookId }
          );
        }

        // Process Mongoose schemas
        for (const schema of file.schemas || []) {
          const schemaId = schema.id;
          await tx.run(
            `MERGE (ms:MongooseSchema {id: $schemaId, projectId: $pid})
             ON CREATE SET ms.name = $name, ms.fieldsJson = $fieldsJson,
               ms.optionsJson = $optionsJson`,
            {
              schemaId: schemaId,
              pid: projectId,
              name: schema.name || null,
              fieldsJson: schema.fieldsJson || null,
              optionsJson: schema.optionsJson || null,
            }
          );
          await tx.run(
            `MATCH (sf:SourceFile {id: $fid}), (ms:MongooseSchema {id: $schemaId})
             MERGE (sf)-[r:CONTAINS_SCHEMA]->(ms)
             ON CREATE SET r.createdAt = datetime()`,
            { fid: file.id, schemaId: schemaId }
          );
        }

        // Process Mongoose models
        for (const model of file.models || []) {
          const modelId = model.id;
          await tx.run(
            `MERGE (mm:MongooseModel {id: $modelId, projectId: $pid})
             ON CREATE SET mm.name = $name, mm.schemaName = $schemaName,
               mm.orm = $orm`,
            {
              modelId: modelId,
              pid: projectId,
              name: model.name || null,
              schemaName: model.schemaName || null,
              orm: model.orm || null,
            }
          );
          await tx.run(
            `MATCH (sf:SourceFile {id: $fid}), (mm:MongooseModel {id: $modelId})
             MERGE (sf)-[r:CONTAINS_MODEL]->(mm)
             ON CREATE SET r.createdAt = datetime()`,
            { fid: file.id, modelId: modelId }
          );
          // USES_SCHEMA relationship: MongooseModel -> MongooseSchema
          if (model.schemaName) {
            await tx.run(
              `MATCH (mm:MongooseModel {id: $modelId}), (ms:MongooseSchema {id: $schemaId})
               MERGE (mm)-[r:USES_SCHEMA]->(ms)
               ON CREATE SET r.createdAt = datetime()`,
              { modelId: modelId, schemaId: model.schemaName }
            );
          }
        }
      }

      return { status: "completed", projectId };
    });

    console.log("KG conversion result:", result);
  } catch (error) {
    console.error("Error converting IR to KG:", error);
    throw error;
  } finally {
    await closeNeo4jDriver();
  }
}