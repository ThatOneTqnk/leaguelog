const league = require('./league.js');
module.exports = class User {
    constructor(name, winObj) {
        this.name = name;
        this.latestWin = winObj; 
    }
}