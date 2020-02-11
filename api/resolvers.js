const { GraphQLScalarType, Kind } = require('graphql');
const passwordHash = require('password-hash');
const jwt = require('jsonwebtoken');
const moment = require('moment');
moment.suppressDeprecationWarnings = true;



const dateScalarType = new GraphQLScalarType({
    name: 'Date',
    description: 'Date object',
    parseValue(value) {
        return value;
    },
    serialize(value) {
        //console.log('serialize');
        var mom = moment(value);
        value = mom.format('DD.MM.YYYY');
        return value;
    },
    parseLiteral(ast) {
        //console.log(ast.value);
        var mom = moment(ast.value, "DD.MM.YYYY");
        var value = mom.format('YYYY-MM-DD');
        return value;
    }
});

const dateTimeScalarType = new GraphQLScalarType({
    name: 'Date',
    description: 'Date object',
    parseValue(value) {
        return value;
    },
    serialize(value) {
        var mom = moment(value);
        value = mom.format('DD.MM.YYYY HH:mm:ss');
        return value;
    },
    parseLiteral(ast) {
        var mom = moment(ast.value, "DD.MM.YYYY HH:mm:ss");
        var value = mom.format('YYYY-MM-DD HH:mm:ss');
        return value;
    }
});

class Resolvers {
    constructor(db_ref) {
        this.db = db_ref;
        var db = db_ref;
        this.resolvers = {
            Date: dateScalarType,
            DateTime: dateTimeScalarType,
            Query: {
                tickets: tickets_resolver,
                projects: projects_resolver,
                project: project_resolver,
                users: users_reolver,
                user: user_resolver,
                ticket: ticket_resolver,
                getToken: getToken_resolver,
                checkToken: checkToken_resolver
            },
            Mutation: {
                deleteTokens: deleteTokens_resolver,
                deleteToken: deleteToken_resolver,
                updateToken: updateToken_resolver,

                changeUserFields: changeUserFields_resolver,
                createUser: createUser_resolver,

                addProject: addProject_resolver,
                addTicket: addTicket_resolver,
                updateProject: updateProject_resolver,
                updateTicket: updateTicket_resolver,
                deleteProject: deleteProject_resolver,
                deleteTicket: deleteTicket_resolver,

                ProjectAddDev: ProjectAddDev_resolver,
                ProjectRemoveDev: ProjectRemoveDev_resolver,

                takeTicket: takeTicket_resolver,
                releaseTicket: releaseTicket_resolver,
                completeTicket: completeTicket_resolver,

                addMessage: addMessage_resolver,
                removeMessage: removeMessage_resolver
            },
            Project: {
                tickets: async(parent) => {
                    return db.select(`SELECT * FROM tickets WHERE "_projectID" = '${parent.ID}'`);
                },
                developers: async(parent) => {
                    return db.select(`SELECT u.* FROM resposes r LEFT JOIN users u ON r."_developerID" = u."ID" WHERE r."_projectID" = '${parent.ID}'`);
                },
                developer: async(parent) => {
                    return db.selectOne(`SELECT * FROM users WHERE "ID" = '${parent._developerID}'`);
                },
            },
            Ticket: {
                tester: async(parent) => {
                    return db.selectOne(`SELECT * FROM users WHERE "ID" = '${parent._testerID}'`);
                },
                developer: async(parent) => {
                    return db.selectOne(`SELECT * FROM users WHERE "ID" = '${parent._developerID}'`);
                },
                project: async(parent) => {
                    return db.selectOne(`SELECT * FROM projects WHERE "ID" = '${parent._projectID}'`);
                },
                messages: async(parent) => {
                    return db.select(`SELECT * FROM messages WHERE "_ticketID" = '${parent.ID}'`);
                },
            },
            User: {

            },
            Message: {
                owner: async(parent) => {
                    return db.selectOne(`SELECT * FROM users WHERE "ID" = '${parent._ownerID}'`);
                },
                ticket: async(parent) => {
                    return db.selectOne(`SELECT * FROM tickets WHERE "ID" = '${parent._ticketID}'`);
                },
            },
        };

        function createUser_resolver(_, { newdata }) {
            newdata.password = passwordHash.generate(newdata.password);
            var email_code = newdata.login + Math.ceil(Math.random() * 1000000);
            var sql_data = [];
            sql_data.push(newdata.login);
            sql_data.push(newdata.password);
            sql_data.push(newdata.first_name);
            sql_data.push(newdata.last_name);
            sql_data.push(newdata.position);


            return db.selectOne(`SELECT "ID" FROM users WHERE "login" = $1`, [newdata.login]).then((res) => {
                if (res != null) {
                    return { status: false, log: 'Пользователь со схожими данными уже существует' };
                } else {
                    return { status: db.exec(`INSERT INTO "users" ("login", "password", "first_name", "last_name", "position") VALUES ($1, $2, $3, $4, $5)`, sql_data) }
                }
            })

        }

        function changeUserFields_resolver(_, { token, newdata }) {

            return checkToken(token, db).then((data) => {
                if (data === 1) {
                    var sql = [];
                    var sql_data = [];
                    var num = 1;
                    for (var prop in newdata) {
                        sql.push('"' + prop + `" = \$${num++}`);
                        sql_data.push(newdata[prop]);
                    }
                    sql_data.push(jwt.decode(token).id);
                    sql = sql.join(',');
                    return { status: db.exec(`UPDATE users SET ${sql} WHERE "ID" = \$${num++}`, sql_data) };
                } else {
                    return { status: false, log: 'token error' };
                }
            });
        }


        function addProject_resolver(_, { token, name, shortname }) {
            return checkToken(token, db).then((data) => {
                if (data === 1) {

                    var sql_data = [];
                    sql_data.push(jwt.decode(token).id);
                    sql_data.push(name);
                    sql_data.push(shortname);
                    var sql = `INSERT INTO "projects" ("_developerID", "name", "shortname")  VALUES ($1, $2, $3) RETURNING "ID";`;

                    return db.insert(sql, sql_data).then((id) => {
                        db.exec('INSERT INTO resposes ("_developerID", "_projectID")  VALUES ($1, $2)', [jwt.decode(token).id, id]); 
                        return id;
                    });

                    

                } else {
                    return false;
                }
            });
        }

        function addTicket_resolver(_, { token, projectID, name, description, severity, priority, type, status }) {
            return checkToken(token, db).then((data) => {
                var token_decoded = jwt.decode(token);
                if (data === 1 && token_decoded.position == 'tester') {

                    var sql_data = [];
                    sql_data.push(projectID);
                    sql_data.push(jwt.decode(token).id);
                    sql_data.push(name);
                    sql_data.push(type);
                    sql_data.push(severity);
                    sql_data.push(priority);
                    sql_data.push(description);
                    var sql = `INSERT INTO "tickets" ("_projectID", "_testerID", "name", "type", "severity", "priority", "description", "status")  VALUES ($1, $2, $3, $4, $5, $6, $7, 'open') RETURNING "ID";`;

                    return db.insert(sql, sql_data).then((id) => { return id;})
                   

                } else {
                    return false;
                }
            });
        }


        function updateToken_resolver(parent, args, context, info) {
            return jwt.verify(args['refresh'], 'O3uBcufY7VOv5o4DFcys', (err, decoded) => {
                if (err) {
                    if (err.name === 'TokenExpiredError') {
                        return { Access: "", Refresh: "" };
                    }
                    return { Access: "", Refresh: "" };
                }

                var sql_data = [args['refresh']];
                return db.selectOne('SELECT status FROM refresh WHERE token = $1', sql_data).then((res) => {
                    if (res != null) {
                        if (res.status) {
                            db.exec('UPDATE refresh SET "status" = false WHERE token = $1', sql_data);
                            var decoded = jwt.decode(args['refresh']);
                            sql_data = [decoded.id];
                            return db.selectOne('SELECT "ID", "position", "password","login" FROM users WHERE "ID" = $1', sql_data).then((res) => {
                                if (res != null) {
                                    var access = jwt.sign({
                                        id: res.ID,
                                        position: res.position,
                                        login: res.login
                                    }, 'O3uBcufY7VOv5o4DFcys', { expiresIn: "1h" });
                                    var refresh = jwt.sign({ id: res.ID }, 'O3uBcufY7VOv5o4DFcys', { expiresIn: "7days" });

                                    var sql_data = [res.ID, refresh];
                                    db.exec(`INSERT INTO "refresh" ("_ownerID", "token", "status") VALUES ($1, $2, true)`, sql_data);

                                    return { Access: access, Refresh: refresh };
                                } else {
                                    return { Access: "", Refresh: "" };
                                }
                            });
                        } else {
                            var decoded = jwt.decode(args['refresh']);
                            var time = moment.utc(new Date()).format("YYYY-MM-DD HH:mm:ss");
                            sql_data = [time, decoded.id];
                            db.exec(`UPDATE users SET "tokens_from" = $1 WHERE "ID" = $2`, sql_data);
                            return { log: "Refresh уже использован", Access: "", Refresh: "" };
                        }
                    } else {
                        return { log: "Refresh не найден", Access: "", Refresh: "" };
                    }
                });
            })

        }

        function tickets_resolver(parent, args, context, info) {
            return db.select(`SELECT * FROM tickets`);
        }

        function projects_resolver(parent, args, context, info) {
            return db.select(`SELECT * FROM projects`);
        }

        function project_resolver(parent, args, context, info) {
            return db.selectOne(`SELECT * FROM projects WHERE "ID" = ${args['id']}`);
        }

        function users_reolver(parent, args, context, info) {
            return db.select(`SELECT * FROM users`);
        }

        function user_resolver(parent, args, context, info) {
            return db.selectOne(`SELECT * FROM users WHERE "ID" = ${args['id']}`);
        }

        function ticket_resolver(parent, args, context, info) {
            return db.selectOne(`SELECT * FROM tickets WHERE "ID" = ${args['id']}`);
        }


        function getToken_resolver(parent, args, context, info) {
            return db.selectOne(`SELECT "ID", "position", "password","login" FROM users WHERE "login" = $1`, [args['login']]).then((res) => {
                if (res != null) {
                    if (passwordHash.verify(args['password'], res.password)) {
                        return db.selectOne('SELECT count("ID") as count FROM refresh WHERE "_ownerID" = $1 AND "status" = true', [res.ID]).then((data) => {
                            if (data.count > 20) {
                                return { Access: "", Refresh: "", log: "too many tokens for accaunt" };
                            } else {
                                var access = jwt.sign({
                                    id: res.ID,
                                    position: res.position,
                                    login: res.login
                                }, 'O3uBcufY7VOv5o4DFcys', { expiresIn: "1h" });
                                var refresh = jwt.sign({ id: res.ID }, 'O3uBcufY7VOv5o4DFcys', { expiresIn: "7days" });

                                var sql_data = [res.ID, refresh];
                                db.exec(`INSERT INTO "refresh" ("_ownerID", "token", "status") VALUES ($1, $2, true)`, sql_data);

                                return { Access: access, Refresh: refresh };
                            }
                        });

                    } else {
                        return { Access: "", Refresh: "", log: "Неправильный пароль" };
                    }
                } else {
                    return { Access: "", Refresh: "", log: "Не найден пользователь с таким логином" };
                }

            })
        }

        function deleteTokens_resolver(parent, args, context, info) {
            return db.selectOne(`SELECT "ID", "password" FROM users WHERE "login" = $1`, [args['login']]).then((res) => {
                if (res != null) {
                    if (passwordHash.verify(args['password'], res.password)) {
                        db.exec('DELETE FROM refresh WHERE "_ownerID" = $1', [res.ID]);
                        var time = moment.utc(new Date()).format("YYYY-MM-DD HH:mm:ss");
                        var sql_data = [time, res.ID];
                        db.exec(`UPDATE users SET "tokens_from" = $1 WHERE "ID" = $2`, sql_data);
                        return { status: true };
                    } else {
                        return { status: false, log: 'Не найден аккаунт с такими данными' };
                    }
                } else {
                    return { status: false, log: 'Не найден аккаунт с такими данными' };
                }

            })
        }

        function deleteToken_resolver(parent, args, context, info) {
            return db.selectOne('SELECT "ID" FROM refresh WHERE "token" = $1', [args['refresh']]).then((data) => {
                if (data != null) {
                    db.exec('UPDATE refresh SET status = false WHERE "ID" = $1', [data.ID]);
                    return { status: true };
                } else {
                    return { status: false, log: 'Не найден аккаунт с такими данными' };
                }
            });
        }

        function checkToken_resolver(parent, args, context, info) {
            return checkToken(args['token'], db);
        }

        function updateProject_resolver(_, { token, id, newdata }) {
            return checkToken(token, db).then((data) => {
                if (data === 1) {

                    var token_decoded = jwt.decode(token);
                    return db.selectOne(`SELECT "_developerID" FROM projects WHERE "ID" = $1`, [id]).then((data) => {
                        if (data != null) {

                            if (data._developerID == token_decoded.id) {
                                var sql_data = [];
                                var sql_set = [];
                                var i = 1;
                                if (newdata.name != null) {
                                    sql_data.push(newdata.name);
                                    sql_set.push('"name" = $' + i);
                                    i++;
                                }
                                if (newdata.shortname != null) {
                                    sql_data.push(newdata.shortname);
                                    sql_set.push('"shortname" = $' + i);
                                    i++;
                                }

                                sql_data.push(id);
                                sql_set = sql_set.join(',');

                                db.exec(`UPDATE projects SET ${sql_set} WHERE "ID" = $${i}`, sql_data);

                                return { status: true };
                            } else {
                                return { status: false, log: 'Вы не имеете права на изменение данного проекта' };
                            }
                        } else {
                            return { status: false, log: 'Проект с заданным ID не существует' };
                        }
                    })

                } else {
                    return { status: false, log: 'Ошибка токена' };
                }
            });
        }

        function updateTicket_resolver(_, { token, id, newdata }) {
            return checkToken(token, db).then((data) => {
                if (data === 1) {

                    var token_decoded = jwt.decode(token);
                    return db.selectOne(`SELECT "_testerID" FROM tickets WHERE "ID" = $1`, [id]).then((data) => {
                        if (data != null) {

                            if (data._testerID == token_decoded.id) {

                                var sql_data = [];
                                var sql_set = [];
                                var i = 1;
                                if (newdata.desctiption != null) {
                                    sql_data.push(newdata.desctiption);
                                    sql_set.push('"desctiption" = $' + i);
                                    i++;
                                }
                                if (newdata.name != null) {
                                    sql_data.push(newdata.name);
                                    sql_set.push('"name" = $' + i);
                                    i++;
                                }
                                if (newdata.priority != null) {
                                    sql_data.push(newdata.priority);
                                    sql_set.push('"priority" = $' + i);
                                    i++;
                                }
                                if (newdata.severity != null) {
                                    sql_data.push(newdata.severity);
                                    sql_set.push('"severity" = $' + i);
                                    i++;
                                }

                                sql_data.push(id);
                                sql_set = sql_set.join(',');

                                db.exec(`UPDATE tickets SET ${sql_set} WHERE "ID" = $${i}`, sql_data);
                                return { status: true };

                            } else {
                                return { status: false, log: 'Вы не имеете права на изменение данного тикета' };
                            }
                        } else {
                            return { status: false, log: 'Тикета с заданным ID не существует' };
                        }
                    })

                } else {
                    return { status: false, log: 'Ошибка токена' };
                }
            });
        }

        function deleteProject_resolver(_, { token, id }) {
            return checkToken(token, db).then((data) => {

                var token_decoded = jwt.decode(token);
                if (data === 1) {

                    return db.selectOne(`SELECT "_developerID" FROM projects WHERE "ID" = $1`, [id]).then((data) => {
                        if (data != null) {
                            if (data._developerID == token_decoded.id) {
                                db.exec('DELETE FROM tickets WHERE "ID" = $1', [id]);

                                db.exec('DELETE FROM projects WHERE "ID" = $1', [id]);
                                db.exec('DELETE FROM resposes WHERE "_projectID" = $1', [id]); 

                                
                                return { status: true };
                            } else {
                                return { status: false, log: 'Вы не имеете права на удаление данного проекта' };
                            }
                        } else {
                            return { status: false, log: 'Проекта с заданным ID не существует' };
                        }
                    })

                } else {
                    return { status: false, log: 'Ошибка токена' };
                }
            });
        }

        function deleteTicket_resolver(_, { token, id }) {
            return checkToken(token, db).then((data) => {

                var token_decoded = jwt.decode(token);
                if (data === 1) {

                    return db.selectOne(`SELECT "_testerID" FROM tickets WHERE "ID" = $1`, [id]).then((data) => {
                        if (data != null) {
                            if (data._testerID == token_decoded.id) {
                                db.exec('DELETE FROM tickets WHERE "ID" = $1', [id]);
                                return { status: true };
                            } else {
                                return { status: false, log: 'Вы не имеете права на удаление данной публикации' };
                            }
                        } else {
                            return { status: false, log: 'Публикация с заданным ID не существует' };
                        }
                    })

                } else {
                    return { status: false, log: 'Ошибка токена' };
                }
            });
        }


        function addMessage_resolver(_, { token, ticketID, content }) {
            return checkToken(token, db).then((data) => {

                var token_decoded = jwt.decode(token);
                if (data === 1) {

                    if(ticketID != null){
                        return db.selectOne(`SELECT "ID" FROM tickets WHERE "ID" = $1`, [ticketID]).then((data_pub) => {
                            if (data_pub != null) {
    
                                return db.insert(`INSERT INTO messages ("_ownerID", "_ticketID", "content")  VALUES ($1, $2, $3) RETURNING "ID";`, [token_decoded.id, ticketID, content]).then((id)=>{
                                    return id;
                                });
    
                                
                            } else {
                                return false;
                            }
                        });
                    }
                } else {
                    return false;
                }
            });
        }

        function removeMessage_resolver(_, { token, id }) {
            return checkToken(token, db).then((data) => {

                var token_decoded = jwt.decode(token);
                if (data === 1) {

                    
                
                    return db.selectOne(`SELECT "_ownerID" FROM messages WHERE "ID" = $1`, [id]).then((data) => {
                        if (data != null) {
                            if (data._ownerID == token_decoded.id) {
                                db.exec('DELETE FROM messages WHERE "ID" = $1', [id]);
                                return { status: true };
                            } else {
                                return { status: false, log: 'Вы не имеете права на удаление данного сообщения' };
                            }
                        } else {
                            return { status: false, log: 'Сообщения с заданным ID не существует' };
                        }
                    })


                } else {
                    return { status: false, log: 'Ошибка токена' };
                }
            });
        }


        function takeTicket_resolver(_, { token, id }) {
            return checkToken(token, db).then((data) => {

                var token_decoded = jwt.decode(token);
                if (data === 1) {
                    if (token_decoded.position != "developer"){
                        return { status: false, log: 'Вы не разработчик' };
                    }
    
                    return db.selectOne(`SELECT "_projectID", "status" FROM tickets WHERE "ID" = $1`, [id]).then((ticket_data) => {
                        if (ticket_data.status == "open"){
                            return db.select(`SELECT "_developerID" FROM resposes WHERE "_projectID" = $1`, [ticket_data._projectID]).then((resposes_data) => {
                                if(resposes_data.map(a => a._developerID).indexOf(token_decoded.id) != -1){
                                    db.exec(`UPDATE tickets SET "_developerID" = $1, "status" = 'inprog'  WHERE "ID" = $2`, [token_decoded.id, id]);
                                    return { status: true, log: 'Вы взяли тикет на себя' };
                                } else {
                                    return { status: false, log: 'Вы не в команде этого проекта' };
                                }
                            })
                        } else {
                            return { status: false, log: 'Кто-то уже взял или решил этот тикет' };
                        }
                    });

                } else {
                    return { status: false, log: 'Ошибка токена' };
                }
            });
        }

        function releaseTicket_resolver(_, { token, id }) {
            return checkToken(token, db).then((data) => {

                var token_decoded = jwt.decode(token);
                if (data === 1) {
                    if (token_decoded.position != "developer"){
                        return { status: false, log: 'Вы не разработчик' };
                    }
    
                    return db.selectOne(`SELECT "_projectID", "status", "_developerID" FROM tickets WHERE "ID" = $1`, [id]).then((ticket_data) => {
                        if (ticket_data.status == "inprog"){
                            if (ticket_data._developerID == token_decoded.id){
                                db.exec(`UPDATE tickets SET "_developerID" = null, "status" = 'open'  WHERE "ID" = $1`, [id]);
                                return { status: true, log: 'Вы отказались от тикета' };
                            } else {
                                return { status: false, log: 'Это не ваш тикет' };
                            }
                        } else {
                            return { status: false, log: 'Этот тикет открыт или выполнен' };
                        }
                    });

                } else {
                    return { status: false, log: 'Ошибка токена' };
                }
            });
        }

        function completeTicket_resolver(_, { token, id }) {
            return checkToken(token, db).then((data) => {

                var token_decoded = jwt.decode(token);
                if (data === 1) {
                    if (token_decoded.position != "developer"){
                        return { status: false, log: 'Вы не разработчик' };
                    }
    
                    return db.selectOne(`SELECT "_projectID", "status", "_developerID" FROM tickets WHERE "ID" = $1`, [id]).then((ticket_data) => {
                        if (ticket_data.status == "inprog"){
                            if (ticket_data._developerID == token_decoded.id){
                                db.exec(`UPDATE tickets SET "status" = 'done'  WHERE "ID" = $1`, [id]);
                                return { status: true, log: 'Вы выполнили тикет' };
                            } else {
                                return { status: false, log: 'Это не ваш тикет' };
                            }
                        } else {
                            return { status: false, log: 'Этот тикет выполнен или не взят' };
                        }
                    });

                } else {
                    return { status: false, log: 'Ошибка токена' };
                }
            });
        }

        function ProjectAddDev_resolver(_, { token, projectID, ids }) {
            return checkToken(token, db).then((data) => {
                var token_decoded = jwt.decode(token);
                if (data === 1) {

                    return db.selectOne(`SELECT "_developerID" FROM projects WHERE "ID" = $1`, [projectID]).then((data) => {
                        if (data != null) {
                            if (data._developerID == token_decoded.id) {
                                var result = [];

                                return new Promise((resolve, reject) => {
                                    ids.forEach((userID, index, array) => {
                                        db.selectOne(`SELECT "ID" FROM resposes WHERE "_projectID" = $1 AND "_developerID" = $2`, [projectID, userID]).then((data) => {
                                            if (data == null) {
                                                db.selectOne(`SELECT "position" FROM users WHERE "ID" = $1`, [userID]).then((data) => {
                                                    if (data != null) {
                                                        if (data.position == "developer") {
                                                            db.exec('INSERT INTO resposes ("_developerID", "_projectID")  VALUES ($1, $2)', [userID, projectID]);
                                                            result.push({ status: true, log: 'Пользователь с ID = '+userID+' успешно добавлен в проект' });
                                                        } else {
                                                            result.push({ status: false, log: 'Пользователь с ID = '+userID+' не является разработчиком' });
                                                        }
                                                    } else {
                                                        result.push({ status: false, log: 'Пользователь с ID = '+userID+' не найден' });
                                                    }

                                                    if (result.length === array.length) resolve();
                                                });
                                            } else {
                                                result.push({ status: false, log: 'Пользователь с ID = '+userID+' уже в проекте' });
                                                if (result.length === array.length) resolve();
                                            }
                                        });                                
                                    });
                                }).then((data)=>{
                                    return result;
                                })

                            } else {
                                return { status: false, log: 'Вы не имеете права на изменение команды проекта' };
                            }
                        } else {
                            return { status: false, log: 'Проекта с заданным ID не существует' };
                        }
                    })


                } else {
                    return [{ status: false, log: 'Ошибка токена' }];
                }
            });
        }

        function ProjectRemoveDev_resolver(_, { token, projectID, ids }) {
            return checkToken(token, db).then((data) => {

                var token_decoded = jwt.decode(token);
                if (data === 1) {

                    return db.selectOne(`SELECT "_developerID" FROM projects WHERE "ID" = $1`, [projectID]).then((data) => {
                        if (data != null) {
                            if (data._developerID == token_decoded.id) {

                                var result = [];


                                return new Promise((resolve, reject) => {
                                    ids.forEach((userID, index, array) => {
                                        db.selectOne(`SELECT "ID" FROM resposes WHERE "_projectID" = $1 AND "_developerID" = $2`, [projectID, userID]).then((data) => {
                                            if (data != null) {
                                                db.selectOne(`SELECT "position" FROM users WHERE "ID" = $1`, [userID]).then((data) => {
                                                    if (data != null) {
                                                        db.exec('DELETE FROM resposes WHERE "_projectID" = $1 AND "_developerID" = $2', [projectID, userID]);     
                                                        result.push({ status: true, log: 'Пользователь с ID = '+userID+' успешно удалён из проекта' });
                                                    } else {
                                                        result.push({ status: false, log: 'Пользователь с ID = '+userID+' не найден' });
                                                    }

                                                    if (result.length === array.length) resolve();
                                                });
                                            } else {
                                                result.push({ status: false, log: 'Пользователь с ID = '+userID+' не в проекте' });


                                                if (result.length === array.length) resolve();
                                            }
    
                                        });
                                                                           
                                    });
                                }).then((data)=>{
                                    return result;
                                })
                                
                            } else {
                                return { status: false, log: 'Вы не имеете права на изменение команды проекта' };
                            }
                        } else {
                            return { status: false, log: 'Проекта с заданным ID не существует' };
                        }
                    })


                } else {
                    return { status: false, log: 'Ошибка токена' };
                }
            });
        }
        


        async function checkToken(token, db) {
            return new Promise(function(resolve, reject) {
                return jwt.verify(token, 'O3uBcufY7VOv5o4DFcys', (err, decoded) => {
                    if (err) {
                        if (err.name === 'TokenExpiredError') {
                            resolve(0);
                            //истёк
                        }
                        resolve(-1);
                        //ложный токен
                    }

                    var sql_data = [decoded.id];
                    return db.selectOne('SELECT "tokens_from" FROM users WHERE "ID" = $1', sql_data).then((res) => {
                        if (res != null && res.tokens_from) {
                            var token_date = new Date(decoded.iat * 1000);
                            var offset = moment(token_date).utcOffset() * 60;
                            if ((moment(token_date).format('X')) - offset > moment(res.tokens_from).format('X')) {
                                resolve(1);
                                // Всё ок
                            } else {
                                resolve(-2);
                                // инвалидирован в базе
                            }
                        } else {
                            resolve(-3);
                            //пользователь уже не существует
                        }
                    });
                })
            });
        }
    }
}

module.exports = Resolvers;