// worker-pool.js (ESM)
import { Worker as BaseWorker } from "node:worker_threads";

interface Job { jobId: string, payload: number[], resolve: (value: Buffer) => void, reject: (value: unknown) => void }

class Worker extends BaseWorker {
    _busy: boolean = false;
    _jobMap: Map<string, Job> = new Map();
    constructor(path, config: { [key: string]: any } = {}) {
        super(path, config);
    }
}

export class WorkerPool {
    private workerPath: string
    private size: number;
    private workers: Worker[] = [];
    private idle: Worker[] = [];
    private queue: Job[] = [];

    constructor({ workerPath, size = 2 }) {
        this.workerPath = workerPath;
        this.size = size;

        for (let i = 0; i < size; i++) this.spawn();
    }

    spawn() {

        const w = new Worker(this.workerPath, {
            workerData: {
                TILE_URL: global.TILE_URL,
                COORDINATE_UNITS: global.COORDINATE_UNITS,
                diffuseMapImages: global.diffuseMapImages
            }
        });

        w.on("message", (msg) => {
            const { ok, result, error, jobId } = msg;
            const job = w._jobMap?.get(jobId);
            if (!job) return;

            w._jobMap.delete(jobId);
            w._busy = false;
            this.idle.push(w);
            this.drain();

            if (ok) job.resolve(Buffer.from(result));
            else job.reject(new Error(error));
        });

        w.on("error", (err) => {
            if (w._jobMap) {
                for (const [, job] of w._jobMap) job.reject(err);
            }
            this.workers = this.workers.filter(x => x !== w);
            this.idle = this.idle.filter(x => x !== w);
            this.spawn();
            this.drain();
        });

        this.workers.push(w);
        this.idle.push(w);
    }

    drain() {
        while (this.idle.length && this.queue.length) {
            const w = this.idle.pop();
            const job = this.queue.shift();
            this.runOnWorker(w, job);
        }
    }

    runOnWorker(w: Worker, job: Job) {
        w._busy = true;
        w._jobMap.set(job.jobId, job);

        w.postMessage({ jobId: job.jobId, payload: job.payload });
    }

    exec(payload: number[]) {
        const jobId = cryptoRandomId();

        return new Promise((resolve: (value: Buffer) => void, reject) => {
            const job = { jobId, payload, resolve, reject };
            if (this.idle.length) {
                const w = this.idle.pop();
                this.runOnWorker(w, job);
            } else {
                this.queue.push(job);
            }
        });
    }
}

function cryptoRandomId() {
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
}