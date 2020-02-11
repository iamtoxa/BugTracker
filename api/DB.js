const pg = require('pg');

class DB {
    constructor() {
        this.pool = new pg.Pool({
            user: '*',
            database: '*',
            password: '*',
            host: "*",
            port: 5432
        });
    }

    async select(sql, sql_data) {
        var pool = this.pool;
        return new Promise(function(resolve, reject) {
            pool.connect(function(err, client, done) {
                if (err) {
                    console.log("Can not connect to the DB" + err);
                    reject();
                }
                client.query(sql, function(err, result) {
                    done();
                    if (err) {
                        console.log(err);
                        reject();
                    }
                    resolve(result.rows);
                })
            });

        });
    }

    async selectOne(sql, sql_data) {
        var pool = this.pool;
        return new Promise(function(resolve, reject) {
            pool.connect(function(err, client, done) {
                if (err) {
                    console.log("Can not connect to the DB" + err);
                    reject();
                }
                client.query(sql, sql_data, function(err, result) {
                    done();
                    if (err) {
                        console.log(err);
                        reject();
                    }
                    resolve(result.rows[0]);
                })
            });
        });
    }

    async exec(sql, sql_data) {
        var pool = this.pool;
        return new Promise(function(resolve, reject) {
            pool.connect(function(err, client, done) {
                if (err) {
                    console.log("Can not connect to the DB" + err);
                    reject();
                }
                client.query(sql, sql_data, function(err) {
                    done();
                    if (err) {
                        console.log(err);
                        resolve(false);
                    }
                    resolve(true);
                })
            });
        });
    }

    async insert(sql, sql_data) {
        var pool = this.pool;
        return new Promise(function(resolve, reject) {
            pool.connect(function(err, client, done) {
                if (err) {
                    console.log("Can not connect to the DB" + err);
                    reject();
                }
                client.query(sql, sql_data, function(err, result) {

                    done();
                    if (err) {
                        console.log(err);
                        resolve(false);
                    }
                    var newlyCreatedUserId = result.rows[0].ID;
                    resolve(newlyCreatedUserId);
                })
            });
        });
    }


    async update(sql, sql_data) {
        var pool = this.pool;
        return new Promise(function(resolve, reject) {
            pool.connect(function(err, client, done) {
                if (err) {
                    console.log("Can not connect to the DB" + err);
                    reject();
                }
                client.query(sql, sql_data, function(err, result) {

                    done();
                    if (err) {
                        console.log(err);
                        resolve(false);
                    }
                    var newlyCreatedUserId = result.rowCount;
                    resolve(newlyCreatedUserId);
                })
            });
        });
    }
}

module.exports = DB;