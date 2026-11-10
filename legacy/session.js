// session.js
let mySession = {};

exports.setMySession = function(username, id, userType, email) {
    mySession.username = username;
    mySession.userId = id;
    mySession.userType = userType; // 'student' or 'company'
    mySession.userEmail = email;
    console.log("Session created for", username, "as", userType, "with ID:", id, "The email is:", email);
};

exports.getMySession = function() {
    return mySession;
};

exports.deleteSession = function() {
    mySession = {};
    console.log("Session deleted.");
};
