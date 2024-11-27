import { parentPort } from 'worker_threads';
import * as fs from 'fs-extra';
import * as path from 'path';

const dataFilePath = path.resolve(__dirname, './worker-data.json');

// 워커 데이터 초기화
const loadData = async () => {
  if (await fs.pathExists(dataFilePath)) {
    return await fs.readJson(dataFilePath);
  }
  return { paths: {} };
};

const saveData = async (data: Record<string, any>) => {
  await fs.writeJson(dataFilePath, data, { spaces: 2 });
};

(async () => {
  const sharedData = await loadData();

  parentPort?.on('message', async (message) => {
    const { type, payload } = message;

    if (type === 'update') {
      for (const path in payload) {
        if (!sharedData.paths[path]) {
          sharedData.paths[path] = {};
        }
        Object.assign(sharedData.paths[path], payload[path]);
      }
      await saveData(sharedData);
    }

    if (type === 'get') {
      parentPort?.postMessage({ type: 'data', payload: sharedData });
    }
  });
})();
