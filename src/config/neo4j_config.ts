import neo4j, { type Driver, type Session } from "neo4j-driver";

let driver: Driver | null = null;

export async function getNeo4jDriver(): Promise<Driver> {
  if (!driver) {
    const uri =  "bolt://localhost:7687";
    const user =  "neo4j";
    const password = "password123";

     driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

     try {
           await driver.verifyConnectivity();
           console.log("Connected to Neo4j database");
         } catch (error) {
           console.error("Failed to connect to Neo4j:", error);
           driver = null;
           throw error;
         }
       }
     
       return driver;
}

export async function getNeo4jSession(): Promise<Session> {
  const d = await getNeo4jDriver();
  return d.session({database : "neo4j"});
}

export async function closeNeo4jDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
    console.log("Neo4j driver closed");
  }
}