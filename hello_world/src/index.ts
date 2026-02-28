import { MongoClient, Db, Collection } from 'mongodb';

interface TestDocument {
  message: string;
  timestamp: Date;
  count: number;
}

async function main() {
  const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017';
  const dbName = process.env.MONGO_DB_NAME || 'proctoring_test';
  const collectionName = 'hello_collection';

  console.log('Starting TypeScript + MongoDB Hello World');
  console.log(`Connecting to MongoDB at: ${mongoUrl}`);

  const client = new MongoClient(mongoUrl);

  try {
    await client.connect();
    console.log('Successfully connected to MongoDB');

    const db: Db = client.db(dbName);
    const collection: Collection<TestDocument> = db.collection(collectionName);

    const testDocument: TestDocument = {
      message: 'Hello world!',
      timestamp: new Date(),
      count: 42
    };

    console.log('\nWriting document to database...');
    const insertResult = await collection.insertOne(testDocument);
    console.log(`Document inserted with ID: ${insertResult.insertedId}`);

    console.log('\nReading document from database...');
    const foundDocument = await collection.findOne({ _id: insertResult.insertedId });

    if (foundDocument) {
      console.log('Document found:');
      console.log(JSON.stringify(foundDocument, null, 2));
    } else {
      console.log('Document not found');
    }

    console.log('\nCollection statistics:');
    const count = await collection.countDocuments();
    console.log(`Total documents in collection: ${count}`);

    console.log('\nCleaning up test data...');
    await collection.deleteOne({ _id: insertResult.insertedId });
    console.log('Test document deleted');

    console.log('\nHello World test completed successfully!');

  } catch (error) {
    console.error('Error occurred:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('MongoDB connection closed');
  }
}

main().catch(console.error);
