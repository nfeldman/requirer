module.exports = {
    onReady: function (callback) {
        if (this.isReady)
            callback.call(this);
        else
            this.callbacks.push(callback);
    },
    ready: function () {
        this.isReady = true;
        for (var i = 0, l = this.callbacks.length; i < l; i++)
            this.callbacks.pop().apply(this, arguments);
    }
};