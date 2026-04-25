import { DataSource } from 'typeorm';
import ormconfig from './src/config/database.config';
const config = ormconfig();
const ds = new DataSource(config);
ds.initialize().then(async () => {
  const jobs = await ds.query('SELECT COUNT(*) FROM job');
  console.log('Total jobs:', jobs);
  const graph = await ds.query('SELECT COUNT(*) FROM graph_knowledge');
  console.log('Total graph:', graph);
  process.exit(0);
});
