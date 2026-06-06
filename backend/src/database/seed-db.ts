import { AppDataSource } from '../config/data-source';
import * as fs from 'fs';
import * as path from 'path';

async function runSeed() {
  try {
    console.log('Connecting to database...');
    await AppDataSource.initialize();
    console.log('Connected to database successfully!');

    const seedFiles = [
      path.join(__dirname, 'seed.sql'),
      path.join(__dirname, '../../../seed_crawled_data.sql'),
    ];

    for (const file of seedFiles) {
      console.log(`Checking seed file: ${file}`);
      if (fs.existsSync(file)) {
        console.log(`Executing ${path.basename(file)}...`);
        const sql = fs.readFileSync(file, 'utf8');
        try {
          await AppDataSource.query(sql);
          console.log(`Successfully executed ${path.basename(file)}`);
        } catch (error) {
          console.error(`Error executing ${path.basename(file)}:`, error);
        }
      } else {
        console.warn(`File not found: ${file}`);
      }
    }

    console.log('Database seeding completed.');
  } catch (error) {
    console.error('Database connection failed:', error);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('Database connection closed.');
    }
  }
}

runSeed();
