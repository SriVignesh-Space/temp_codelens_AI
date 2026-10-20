export const NODE_TYPES = {
  Project : {
    "label": "Project",
    "description": "A CodeLens project representing one analyzed repository.",
    "properties": [
      { "name": "id", "type": "STRING" },
      { "name": "generatedAt", "type": "STRING" },
    ],
  },
  SourceFile :  {
        "label": "SourceFile",
        "description": "A successfully parsed source file in a repository.",
        "properties": [
            {"name": "id", "type": "STRING"},
            {"name": "path", "type": "STRING"},
            {"name": "language", "type": "STRING"},
        ],
    },
    Import : {
        "label": "Import",
        "description": "An extracted import declaration.",
        "properties": [
            {"name": "id", "type": "STRING"},
            {"name": "source", "type": "STRING"},
            {"name": "importKind", "type": "STRING"},
            {"name": "importedName", "type": "STRING"},
            {"name": "localName", "type": "STRING"},
            {"name": "file", "type": "STRING"},
            {"name": "startLine", "type": "INTEGER"},
            {"name": "startColumn", "type": "INTEGER"},
        ],
    },
    Export : {
        "label": "Export",
        "description": "An extracted export declaration.",
        "properties": [
            {"name": "id", "type": "STRING"},
            {"name": "exportKind", "type": "STRING"},
            {"name": "name", "type": "STRING"},
            {"name": "file", "type": "STRING"},
            {"name": "startLine", "type": "INTEGER"},
            {"name": "startColumn", "type": "INTEGER"},
        ],
    },
    Function  : {
        "label": "Function",
        "description": "An extracted function declaration or supported function expression.",
        "properties": [
            {"name": "id", "type": "STRING"},
            {"name": "name", "type": "STRING"},
            {"name": "async", "type": "BOOLEAN"},
            {"name": "generator", "type": "BOOLEAN"},
            {"name": "parametersJson", "type": "STRING"},
            {"name": "returnType", "type": "STRING"},
            {"name": "file", "type": "STRING"},
            {"name": "startLine", "type": "INTEGER"},
            {"name": "startColumn", "type": "INTEGER"},
            {"name": "endLine", "type": "INTEGER"},
            {"name": "endColumn", "type": "INTEGER"},
        ],
    },
    Class : {
        "label": "Class",
        "description": "An extracted class with nested method metadata.",
        "properties": [
            {"name": "id", "type": "STRING"},
            {"name": "name", "type": "STRING"},
            {"name": "abstract", "type": "BOOLEAN"},
            {"name": "methodsJson", "type": "STRING"},
            {"name": "file", "type": "STRING"},
            {"name": "startLine", "type": "INTEGER"},
            {"name": "startColumn", "type": "INTEGER"},
        ],
    },
    Call : {
        "label": "Call",
        "description": "A detected call expression; its target may be unresolved.",
        "properties": [
            {"name": "id", "type": "STRING"},
            {"name": "callee", "type": "STRING"},
            {"name": "argumentCount", "type": "INTEGER"},
            {"name": "file", "type": "STRING"},
            {"name": "startLine", "type": "INTEGER"},
            {"name": "startColumn", "type": "INTEGER"},
            {"name": "endLine", "type": "INTEGER"},
            {"name": "endColumn", "type": "INTEGER"},
        ],
    },
    Route : {
        "label": "Route",
        "description": "A statically extracted Express route declaration.",
        "properties": [
            {"name": "id", "type": "STRING"},
            {"name": "method", "type": "STRING"},
            {"name": "path", "type": "STRING"},
            {"name": "router", "type": "STRING"},
            {"name": "handlerId", "type": "STRING"},
            {"name": "middlewareJson", "type": "STRING"},
            {"name": "file", "type": "STRING"},
            {"name": "startLine", "type": "INTEGER"},
            {"name": "startColumn", "type": "INTEGER"},
        ],
    },
    Component : {
        "label": "Component",
        "description": "An extracted React component.",
        "properties": [
            {"name": "id", "type": "STRING"},
            {"name": "name", "type": "STRING"},
            {"name": "style", "type": "STRING"},
            {"name": "file", "type": "STRING"},
            {"name": "startLine", "type": "INTEGER"},
            {"name": "startColumn", "type": "INTEGER"},
        ],
    },
    Hook : {
        "label": "Hook",
        "description": "A detected React hook.",
        "properties": [
            {"name": "id", "type": "STRING"},
            {"name": "name", "type": "STRING"},
            {"name": "file", "type": "STRING"},
            {"name": "startLine", "type": "INTEGER"},
            {"name": "startColumn", "type": "INTEGER"},
        ],
    },
    MongooseSchema : {
        "label": "MongooseSchema",
        "description": "An extracted Mongoose schema with statically inferred fields.",
        "properties": [
            {"name": "id", "type": "STRING"},
            {"name": "name", "type": "STRING"},
            {"name": "fieldsJson", "type": "STRING"},
            {"name": "optionsJson", "type": "STRING"},
            {"name": "file", "type": "STRING"},
            {"name": "startLine", "type": "INTEGER"},
            {"name": "startColumn", "type": "INTEGER"},
        ],
    },
    MongooseModel : {
        "label": "MongooseModel",
        "description": "An extracted Mongoose model.",
        "properties": [
            {"name": "id", "type": "STRING"},
            {"name": "name", "type": "STRING"},
            {"name": "schemaName", "type": "STRING"},
            {"name": "orm", "type": "STRING"},
            {"name": "file", "type": "STRING"},
            {"name": "startLine", "type": "INTEGER"},
            {"name": "startColumn", "type": "INTEGER"},
        ],
    },
}

export const RELATIONSHIP_TYPES = [
    {
        "label": "CONTAINS_FILE",
        "description": "A project contains a source file.",
    },
    {
        "label": "CONTAINS_IMPORT",
        "description": "A source file contains an import declaration.",
    },
    {
        "label": "CONTAINS_EXPORT",
        "description": "A source file contains an export declaration.",
    },
    {
        "label": "CONTAINS_FUNCTION",
        "description": "A source file contains a function.",
    },
    {
        "label": "CONTAINS_CLASS",
        "description": "A source file contains a class.",
    },
    {
        "label": "CONTAINS_CALL",
        "description": "A source file contains a call expression.",
    },
    {
        "label": "CONTAINS_ROUTE",
        "description": "A source file contains an Express route.",
    },
    {
        "label": "CONTAINS_COMPONENT",
        "description": "A source file contains a React component.",
    },
    {
        "label": "CONTAINS_HOOK",
        "description": "A source file contains a detected hook.",
    },
    {
        "label": "CONTAINS_SCHEMA",
        "description": "A source file declares a Mongoose schema.",
    },
    {
        "label": "CONTAINS_MODEL",
        "description": "A source file declares a Mongoose model.",
    },
    {
        "label": "IMPORTS_FILE",
        "description": "A source file imports another resolved source file.",
    },
    {
        "label": "HANDLES",
        "description": "A function is the resolved handler for an Express route.",
    },
    {
        "label": "USES_SCHEMA",
        "description": "A Mongoose model references a resolved schema.",
    },
    {
        "label": "DECLARES_EXPORT",
        "description": "An export declaration exposes a resolved function.",
    },
    {
        "label": "CALLS_FUNCTION",
        "description": "A call expression resolves to a function declaration.",
    },
]

export const PATTERNS = [
    ["Project", "CONTAINS_FILE", "SourceFile"],
    ["SourceFile", "CONTAINS_IMPORT", "Import"],
    ["SourceFile", "CONTAINS_EXPORT", "Export"],
    ["SourceFile", "CONTAINS_FUNCTION", "Function"],
    ["SourceFile", "CONTAINS_CLASS", "Class"],
    ["SourceFile", "CONTAINS_CALL", "Call"],
    ["SourceFile", "CONTAINS_ROUTE", "Route"],
    ["SourceFile", "CONTAINS_COMPONENT", "Component"],
    ["SourceFile", "CONTAINS_HOOK", "Hook"],
    ["SourceFile", "CONTAINS_SCHEMA", "MongooseSchema"],
    ["SourceFile", "CONTAINS_MODEL", "MongooseModel"],

    ["SourceFile", "IMPORTS_FILE", "SourceFile"],
    ["Route", "HANDLES", "Function"],
    ["MongooseModel", "USES_SCHEMA", "MongooseSchema"],
    ["Export", "DECLARES_EXPORT", "Function"],
    ["Call", "CALLS_FUNCTION", "Function"],
];

export const CODELENS_SCHEMA = {
    "node_types": NODE_TYPES,
    "relationship_types": RELATIONSHIP_TYPES,
    "patterns": PATTERNS,
    "additional_node_types": false,
    "additional_relationship_types": false,
    "additional_patterns": false,
}