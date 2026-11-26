import './config.js';
import { createApp } from './app.js';

const port = Number(process.env.PORT) || 5000;
const app = createApp();

app.listen(port, () => console.log(`Explain It Back API listening on port ${port}`));
