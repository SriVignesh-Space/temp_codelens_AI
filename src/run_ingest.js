import { convertJsonToKg } from "./controller/KGbuild.js";

const PROJECT_ID = "387c2299-9a15-4959-aa30-39f362d403b4";

export default async function run() {
    try {
        console.log(`🚀 Starting ingestion for project: ${PROJECT_ID}...`);
        const stats = await convertJsonToKg(PROJECT_ID, { reset: true });

        console.log("\n✅ Ingestion Complete!");
        console.log("-----------------------------------");
        console.log(`Nodes Created: ${stats.nodesTotal}`);
        console.log(`Relationships Created: ${stats.relationshipsTotal}`);
        console.log("-----------------------------------");
        console.log("Breakdown by Label:");
        console.log(stats.nodes);
        console.log("\nBreakdown by Relationship:");
        console.log(stats.relationships);
        console.log("\nUnresolved Entities:");
        console.log(stats.unresolved);
        if (stats.ignoredProperties.length > 0) {
            console.log("\nIgnored Properties:", stats.ignoredProperties);
        }
    } catch (error) {
        console.error("\n❌ Ingestion Failed:");
        console.error(error);
        process.exit(1);
    }
}
