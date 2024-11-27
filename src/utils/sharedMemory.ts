import { Worker } from 'worker_threads';
import * as path from 'path';

const worker = new Worker(path.resolve(__dirname, './sharedWorker.js'));

export const updateData = (data: Record<string, any>): void => {
  worker.postMessage({ type: 'update', payload: data });
};

export const getData = (): Promise<Record<string, any>> => {
  return new Promise((resolve) => {
    worker.once('message', (message) => {
      if (message.type === 'data') {
        resolve(message.payload);
      }
    });
    worker.postMessage({ type: 'get' });
  });
};
