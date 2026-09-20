
const firebaseConfig = {
  apiKey: "AIzaSyB5Wxn_F4ivEQa1jxnZfuNulDDTuoF3c-8",
  authDomain: "project-4078356158921795630.firebaseapp.com",
  databaseURL: "https://project-4078356158921795630-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "project-4078356158921795630",
  storageBucket: "project-4078356158921795630.firebasestorage.app",
  messagingSenderId: "404530802883",
  appId: "1:404530802883:web:e8bcab4e1e94f87cb9b276",
  measurementId: "G-TV9MZRTD0G",
}

firebase.initializeApp(firebaseConfig)

const db = firebase.database()
const auth = firebase.auth()

let currentUser = null

function initAuth() {
  return auth.signInAnonymously().then((userCredential) => {
    currentUser = userCredential.user
    return currentUser
  })
}

function getCurrentUser() {
  return currentUser
}

function getUserId() {
  return currentUser ? currentUser.uid : null
}