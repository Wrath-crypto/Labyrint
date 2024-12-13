Array.prototype.random = function () {

    let index = Math.round(Math.random() * this.length);
    return this[index];

}

Number.randomBetween = function(min, max) {
    return Math.floor(Math.random() * (max - min + 1) ) + min;
}

