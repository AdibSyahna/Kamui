export class Mutex {
    private mutex = Promise.resolve();

    // The lock function waits for the mutex to be free, then locks it
    public async lock() {
        let unlockNext: () => void;

        // Creates a new promise, assigning the resolve function to unlockNext
        const willLock = new Promise<void>(resolve => (unlockNext = resolve));

        // Queue up the lock request by chaining the willLock promise
        const previousLock = this.mutex;
        this.mutex = this.mutex.then(() => willLock);

        // Wait until the previous lock is released
        await previousLock;

        // Return the function that will unlock the mutex
        return unlockNext!;
    }
}
