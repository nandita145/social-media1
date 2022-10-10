const express = require('express');
const app = express();
var http = require('http').createServer(app);

var mongodb = require('mongodb');
var ObjectId = mongodb.ObjectId;
var mongoClient = mongodb.MongoClient;

mainUrl = 'http://localhost:3000/';
var database = null;

app.use('/public', express.static(__dirname + '/public'));
app.set('view engine', 'ejs');
app.use(express.json());

var expressSession = require('express-session');
app.use(expressSession({
    'key': 'user_id',
    'secret': 'user secret object ID',
    'resave': true,
    'saveUninitialized': true
}));

var bodyParser = require('body-parser');
app.use(bodyParser.json({ limit: '10000mb' }));
app.use(bodyParser.urlencoded({
    extended: true, limit: '10000mb',
    parameterLimit: 1000000
}));

var bcrypt = require('bcrypt');

var formidable = require('formidable');
// const formidable = require("express-formidable")
// app.use(formidable({
//     multiples: true, // request.files to be arrays of files
// }))

var fileSystem = require('fs');
const { toArray } = require('mongodb/lib/operations/cursor_ops');
// const multer = require("multer");
// const { response } = require('express');

function getUser(userId, callBack) {
    database.collection('users').findOne({
        '_id': ObjectId(userId)
    }, function (error, result) {
        if (error) {
            console.log(error);
            return;
        }
        if (callBack != null) {
            callBack(result)
            // console.log(result)
        }
    });
}

http.listen(process.env.PORT || 3000, function () {
    console.log("Connected");

    mongoClient.connect("mongodb://localhost:27017", { useUnifiedTopology: true },
        function (error, client) {
            if (error) {
                console.log(error);
                return;
            }
            database = client.db("image_sharing_app");

            app.get('/',async function (request, response) {
                var ses=request.session.user_id
                if (request.session.user_id) {
                // console.log("ses",ses)
                var loggedInUser= await database.collection('users').findOne({
                    '_id': ObjectId(request.session.user_id)
                    });
                // console.log(loggedInUser)
                var myFollowing=loggedInUser.following;
                // console.log(myFollowing)
                const arr = [];

                myFollowing.forEach(object => {
                arr.push(ObjectId(object._id));
                });

// console.log(arr[0]);
                // console.log(myFollowingArray)
                
                // console.log(arr[0])

                var followersPost=await database.collection('images').find({"user._id": { $in: arr } }).sort({
                    'createdAt': -1
                }).toArray(function (error1, images) {
                    if (request.session.user_id) {
                        getUser(request.session.user_id, function (user) {
                            // console.log(user)
                            // console.log(images)
                            response.render('index', {
                                'isLogin': true,
                                'query': request.query,
                                'user': user,
                                'images': images
                            });
                        })
                    } 


                });
            }else {
                // response.render('index', {
                //     'isLogin': false,
                //     'query': request.query,
                //     'images': images
                // });
            response.redirect('/login')
            }
                // console.log("followerspost",followersPost)
                // database.collection('images').find().sort({
                //     'createdAt': -1
                // }).toArray(function (error1, images) {
                //     if (request.session.user_id) {
                //         getUser(request.session.user_id, function (user) {
                //             // console.log(user)
                //             // console.log(images)
                //             response.render('index', {
                //                 'isLogin': true,
                //                 'query': request.query,
                //                 'user': user,
                //                 'images': images
                //             });
                //         })
                //     } else {
                //         // response.render('index', {
                //         //     'isLogin': false,
                //         //     'query': request.query,
                //         //     'images': images
                //         // });
                //         response.redirect('/login')
                //     }


                // });


            });


            app.get('/register', function (request, response) {
                response.render('register', {
                    'query': request.query
                });
            });

            app.post('/register', function (request, response) {
                if (request.body.password != request.body.confirm_password) {
                    response.redirect('/register?error=mismatch');
                    return;
                }

                database.collection('users').findOne({
                    'email': request.body.email
                }, function (error1, user) {
                    if (user == null) {
                        bcrypt.hash(request.body.password, 10, function (error3, hash) {
                            database.collection('users').insertOne({
                                'name': request.body.name,
                                'email': request.body.email,
                                'password': hash,
                                'followers':[],
                                'following':[]
                            }, function (error2, data) {
                                response.redirect('/login?message=registered')
                            });
                        });
                    } else {
                        response.redirect('/register?error=exists');
                    }
                });
            });

            app.get('/login', function (request, response) {
                response.render('login', {
                    'query': request.query
                });
            });

            app.post('/login', function (request, response) {
                var email = request.body.email;
                var password = request.body.password;

                database.collection('users').findOne({
                    'email': email
                }, function (error1, user) {
                    if (user == null) {
                        response.redirect('/login?error=not_exists');
                    } else {
                        bcrypt.compare(password, user.password, function (error2, isPasswordVerify) {
                            if (isPasswordVerify) {
                                request.session.user_id = user._id;
                                response.redirect('/');
                            } else {
                                response.redirect('login?error=wrong_password')
                            }
                        });
                    }
                })
            });

            app.get('/logout', function (request, response) {
                request.session.destroy();
                response.redirect('/');
            });

            
            app.get('/my_uploads', function (request, response) {
                if (request.session.user_id) {
                    getUser(request.session.user_id, function (user) {
                        database.collection('images').find({
                            'user._id': ObjectId(request.session.user_id)
                        }).sort({
                            'createdAt': -1
                        }).toArray(function (error1, images) {
                            // console.log(images)
                            // console.log(user+'myuploads')
                            response.render('index', {
                                'isLogin': true,
                                'query': request.query,
                                'images': images,
                                'user': user
                            })

                        })
                    })
                } else {
                    response.redirect('login');
                }
            });

            // var fs=require('fs-extra');

            app.post('/upload-image', async function (request, response) {
                if(request.session.user_id){
                    var formData=new formidable.IncomingForm();
                    formData.maxFileSize=1000*1024*1024;
                    formData.parse(request, function (error1, fields, files) {
                        // console.log(files);
                        // console.log(fields)
                        var oldPath=files.image.path;
                        var caption=fields.caption;
                        // console.log(caption)
                        // console.log(oldPath)
                        // var oldPath='ok'
                        var newPath = 'public/uploads/'+new Date().getTime()+'-'+files.image.name;
                        // console.log(user)
                        // console.log(newPath)
                        fileSystem.rename(oldPath, newPath, function (error2) {
                            getUser(request.session.user_id, function (user) {
                                
                            // console.log(user+'uploimg')
                            delete user.password;
                            var currentTime = new Date().getTime();

                            database.collection('images').insertOne({
                                'filePath': newPath,
                                'user': user,
                                'caption':caption,
                                'createdAt':currentTime,
                                'likers':[],
                                'comments':[]

                            }, function (error2, data) {
                                response.redirect('/?message=image_uploaded');
                            })
                        })
                    })
                    })
                }
            })
             


            app.get('/view-image', function (request, response) {
                // console.log(request.query.id)
                database.collection("images").findOne({                    
                    "_id": ObjectId(request.query.id)
                }, function (error1, image) {
                    if(request.session.user_id){
                        getUser(request.session.user_id, function (user) {
                            // console.log(image);
                            response.render("view-image",{
                                "isLogin":true,
                                "query":request.query,
                                "image":image,
                                "user":user
                            }); 
                        });
                    }else{
                        response.render("view-image", {
                            "isLogin":false,
                            "query":request.query,
                            "image":image,
                            
                        })
                    }
                    
                })
            });


            app.post('/do-like', function (request, response) {
                if(request.session.user_id){
                    database.collection('images').findOne({
                        '_id': ObjectId(request.body._id),
                        'likers._id':request.session.user_id
                    }, function (error1, video) {
                        if(video==null){
                            database.collection("images").updateOne({
                                "_id": ObjectId(request.body._id)
                            },{
                                $push:{
                                    "likers":{
                                        "_id": request.session.user_id
                                    }
                                }
                            }, function (erro2, data) {
                                response.json({
                                    'status':'success',
                                    'message':'Image has been liked'
                                });
                            });
                        }else{
                            response.json({
                                'status':'error',
                                'message':'You have already liked this image.'
                            });
                        }
                    });
                }else{
                    response.json({
                        'status':'error',
                        'message':'Please login to perform this action.'
                    });
                }
            });


            app.post('/do-comment', function (request, response) {
                if(request.session.user_id){
                    var comment=request.body.comment;
                    var _id=request.body._id;

                    getUser(request.session.user_id, function (user) {
                        delete user.password;

                        database.collection('images').findOneAndUpdate({
                            '_id':ObjectId(_id)
                        },{
                            $push:{
                                'comments':{
                                    '_id':ObjectId(),
                                    'user':user,
                                    'comment':comment,
                                    'createdAt': new Date().getTime()
                                }
                            }
                        }, function (error1, data) {
                            response.redirect('/view-image?id='+_id+'&message=success#comments')
                        });
                    });
                }else{
                    response.redirect('/view-image?id'+_id+"&error=not_login#comments")
                }
            });







            app.get('/search', function (request, response) {
                // collection= db.collection('users');
                if(request.session.user_id){
                    getUser(request.session.user_id, function (user) {
                            database.collection('users').find({
                                'name': {$regex : `^${request.query.search}.*` , $options: 'si' }
                            }).toArray(function (error1, search) {
                                // console.log(images)
                                // console.log(user+'myuploads')
                                response.render('search', {
                                    'isLogin': true,
                                    'query': request.query,
                                    'user':user,
                                    // 'images': images,
                                    'search': search,
                                    'count':search.length,
                                });
                                // console.log(search)
                            })
                // console.log(result)

                    })
                } 
            })

            // app.get('/search', function (request, response) {
            //     // database.collection('users').find({
            //     //     'user.name': {$regex : `^${request.query.search}.*` , $options: 'si' }
            //     // }).toArray()
            //     // console.log()
            //     if (request.session.user_id) {
            //         getUser(request.session.user_id, function (user) {
            //         console.log(request.query.search)    
                    
            //         database.collection('users').find({
            //                 'name': {$regex : `^${request.query.search}.*` , $options: 'si' }
            //         }, toArray( function (error1, user) {
                        
            //         })
            //         )
            //     })
                
            // }
            // });

            // // app.get('/search',(request,res)=>{  
            // //     if(request.session.user_id){
            // //     try {  
            // //         var search= database.collection('users').find({'name': {$regex : `^${request.query.search}.*` , $options: 'si' }},(err,data)=>{  
            // //     if(err){  
            // //     console.log(err);  
            // //     }else{  
            // //     res.render('search',{data:data});  
            // //     console.log(data.documents)
            // //     }  
            // //     })  
            // //     } catch (error) {  
            // //     console.log(error);  
            // //     }  
            // //     }
            // //     console.log(search)
            // // }); 


            app.get('/view-profile',  function (request, response) {
                if (request.session.user_id) {
                    getUser(request.session.user_id, async function (user) {
                                
                    requested_user=request.query.id;
                    // console.log("ru",requested_user)
                    var requestedUser=await database.collection('users').find({
                    '_id': ObjectId(requested_user)
                    }).toArray()
                    // let rU= await requestedUser()
                    // console.log(requestedUser)
                    // console.log("ru",requestedUser[0]._id)
                    // console.log("ru",requestedUser[0].name)
                    var Images = await database.collection('images').find({
                        'user._id': ObjectId(requested_user)
                    }).toArray()

                    var followStatus= await database.collection('users').findOne({
                        '_id': ObjectId(requested_user),
                        'followers._id':request.session.user_id
                    })
                    // console.log(followStatus)
                    var following='Follow';
                    if(followStatus){
                        following='Following'
                    }else{
                        following='Follow'
                    }
                    // console.log("images", Images)
                    var ownProfile= user._id.toString()==requestedUser[0]._id.toString()?true:false
                    // console.log(ownProfile)
                    response.render('view-profile', {
                        'isLogin': true,
                        'query': request.query,
                        'images': Images,
                        'user': user,
                        'requestedUser': requestedUser[0],
                        'following':following,
                        'ownProfile': ownProfile
                                    
                    });
                    // console.log(user._id)
                    // console.log(requestedUser[0]._id)

                });
            }
            });

            app.post('/follow', function (request, response) {
                if (request.session.user_id) {
                    getUser(request.session.user_id, async function (user) {
                        var idToFollow = request.body.follow;
                        // console.log(idToFollow);
                        var RequestedUserArray = await database.collection('users').findOneAndUpdate({
                            '_id': ObjectId(idToFollow)
                        }, {
                            $addToSet: {
                                "followers": {
                                    "_id": request.session.user_id
                                }
                            }
                        })
                    
                        var loggedInUserArray = await database.collection('users').findOneAndUpdate({
                            '_id': ObjectId(request.session.user_id)
                        }, {
                            $addToSet: {
                                "following": {
                                    "_id": idToFollow
                                }
                           
                            }
                        })
                        response.redirect('view-profile?id='+idToFollow)

                })
            }
        });
        app.post('/unfollow', function (request, response) {
            if (request.session.user_id) {
                getUser(request.session.user_id, async function (user) {
                    var idToFollow = request.body.follow;
                    // console.log(idToFollow);
                    var RequestedUserArray = await database.collection('users').findOneAndUpdate({
                        '_id': ObjectId(idToFollow)
                    }, {
                        $pull: {
                            "followers": {
                                "_id": request.session.user_id
                            }
                        }
                    })
                
                    var loggedInUserArray = await database.collection('users').findOneAndUpdate({
                        '_id': ObjectId(request.session.user_id)
                    }, {
                        $pull: {
                            "following": {
                                "_id": idToFollow
                            }
                       
                        }
                    })
                    response.redirect('view-profile?id='+idToFollow)

            })
        }
    })

                    



            // app.get('/view-profile', function (request, response) {
            //     if (request.session.user_id) {
            //         getUser(request.session.user_id, function (user) {
                        
            //             requested_user=request.query.id;
            //             console.log(requested_user)
            //             database.collection('users').find({
            //                 'user._id': ObjectId(requested_user)
            //             }
            //             // database.collection('images').find({
            //             //     'user._id': ObjectId(requested_user)
            //             // }
            //             ).sort({
            //                 'createdAt': -1
            //             }).toArray(function (error1, images, users) {
            //                 // console.log(images)
            //                 // console.log(user+'myuploads')
            //                 response.render('view-profile', {
            //                     'isLogin': true,
            //                     'query': request.query,
            //                     'images': images,
            //                     'user': user,
            //                     // 'requested_user': users.name
                        
            //                 })

            //             })
            //         })
            //     } else {
            //         response.redirect('login');
            //     }
            // });

        });
});





            // var uploadModel = mongoose.model('image',uploadSchema)
            // var Storage = multer.diskStorage({
            //     destination: function (req, file, callback) {
            //       callback(null, "./public/uploads");
            //     },
            //     filename: function (req, file, callback) {
            //       callback(null, file.fieldname + "_" + Date.now() + "_" + file.originalname);
            //     },
            //   });
               
            // var upload = multer({
            //     storage: Storage,
            // }).single("image"); //Field name and max count

            // app.post("/upload-image", (req, res) => {
            //     upload(req, res, function (err) {
            //       if (err) {
            //         console.log(err);
            //         return res.end("Something went wrong");
            //       } else {
            //         console.log(req.file.path);
            //         var imageName = req.file.filename;
               
            //         // var imageDetails = new imageModel({
            //         //   imagename: imageName,
            //         // });
            //         var imageDetails= database.collection('images').insertOne({
            //                                     'filePath': newPath,
            //                                     'user': user,
            //                                     'createdAt': currentTime,
            //                                     'likers': [],
            //                                     'comments': []
            //                                 }, function (error2, data) {
            //                                     response.redirect('/?message=image_uploaded');
            //                                 });
               
            //         imageDetails.save(function (err, doc) {
            //           if (err) throw err;
               
            //           console.log("Image Saved");
               
            //           imageData.exec(function(err,data){
            //               if(err) throw err;
               
               
            //               res.render('/',{records:data,success:true})
            //           })
            //         });
            //       }
            //     });
            //   });
               

            

            // app.post('/upload-image', async function (request, response) {
            //     if (request.session.user_id) {
            //         var formData = new formidable.IncomingForm();
            //         console.log(formData);
            //         formData.maxFileSize = 1000 * 1024 * 1024;

            //         formData.parse(request, function (error1, fields, files) {
            //             console.log(files)
            //             var oldPath = files.image.path;
            //             // console.log(oldPath)
            //             console.log(files.image.name);
            //             var newPath = 'public/uploads/' + new Date().getTime() + "-" + files.image.name ;
            //             console.log(newPath)
            //             // var ok= files.mv(newPath);
            //             // console.log(ok)
            //             fileSystem.rename(oldPath, newPath, function (error2) {
            //                 getUser(request.session.user_id, function (user) {
            //                     delete user.password;
            //                     var currentTime = new Date().getTime();

            //                     database.collection('images').insertOne({
            //                         'filePath': newPath,
            //                         'user': user,
            //                         'createdAt': currentTime,
            //                         'likers': [],
            //                         'comments': []
            //                     }, function (error2, data) {
            //                         response.redirect('/?message=image_uploaded');
            //                     });

            //                 });
            //             });
            //         });
            //     }else{
            //         response.redirect('/login')
            //     }

            // });

            // app.post('/upload-image', async function (request, response) {
            //     if (request.session.user_id) {
            //         // var formData = new formidable.IncomingForm();
            //         // console.log(formData);
            //         // formData.maxFileSize = 1000 * 1024 * 1024;
            //         upload(request, response, (err) => {
            //             if(err) {
            //                 response.status(400).send("Something went wrong!");
            //             }
            //             response.send(request.file);
            //           });
            //         // formData.parse(request, function (error1, fields, files) {
            //         //     console.log(files)
            //         //     var oldPath = files.image.filepath;
            //         //     // console.log(oldPath)
            //         //     console.log(files.image.originalFilename);
            //         //     var newPath = 'public/uploads/' + new Date().getTime() + "-" + files.image.originalFilename ;
            //         //     console.log(newPath)
            //         //     // var ok= files.mv(newPath);
            //         //     // console.log(ok)
            //         //     fileSystem.rename(oldPath, newPath, function (error2) {
            //         //         getUser(request.session.user_id, function (user) {
            //         //             // delete user.password;
            //         //             var currentTime = new Date().getTime();

            //         //             database.collection('images').insertOne({
            //         //                 'filePath': newPath,
            //         //                 'user': user,
            //         //                 'createdAt': currentTime,
            //         //                 'likers': [],
            //         //                 'comments': []
            //         //             }, function (error2, data) {
            //         //                 response.redirect('/?message=image_uploaded');
            //         //             });

            //         //         });
            //         //     });
            //         // });
            //     }else{
            //         response.redirect('/login')
            //     }

            // });

            // app.post("/upload-image", async function (request, result) {
            //     var formData = new formidable.IncomingForm();
            //     const images = []
            //     if (Array.isArray(request.files.images)) {
            //         for (let a = 0; a < request.files.images.length; a++) {
            //             images.push(request.files.images[a])
            //         }
            //     } else {
            //         images.push(request.files.images)
            //     }
             
            //     callbackFileUpload(images, 0, [], async function (savedPaths) {
            //         await db.collection("images").insertOne({
            //             images: savedPaths
            //         })
             
            //         result.send("Images has been uploaded.")
            //     })
            // });
            
            // function callbackFileUpload(images, index, savedPaths = [], success = null) {
            //     const self = this
             
            //     if (images.length > index) {
             
            //         fileSystem.readFile(images[index].path, function (error, data) {
            //             if (error) {
            //                 console.error(error)
            //                 return
            //             }
             
            //             const filePath = "uploads/" + new Date().getTime() + "-" + images[index].name
                         
            //             fileSystem.writeFile(filePath, data, async function (error) {
            //                 if (error) {
            //                     console.error(error)
            //                     return
            //                 }
             
            //                 savedPaths.push(filePath)
             
            //                 if (index == (images.length - 1)) {
            //                     success(savedPaths)
            //                 } else {
            //                     index++
            //                     callbackFileUpload(images, index, savedPaths, success)
            //                 }
            //             })
             
            //             fileSystem.unlink(images[index].path, function (error) {
            //                 if (error) {
            //                     console.error(error)
            //                     return
            //                 }
            //             })
            //         })
            //     } else {
            //         success(savedPaths)
            //     }
            // }