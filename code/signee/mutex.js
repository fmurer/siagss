class Mutex {

    constructor() {
        this._busy = false;
        this._queue = [];
    }

    synchronize(task) {
        this._queue.push(task);
        if (!this._busy) {
            this._dequeue();
        }
    }

    _dequeue() {
        this._busy = true;
        var next = this._queue.shift();

        if (next) {
            this._execute(next);
        } else {
            this._busy = false;
        }
    }

    _execute(task) {
        task().then(function() {
            this._busy = false;
        });
    }
}

module.exports = Mutex;
