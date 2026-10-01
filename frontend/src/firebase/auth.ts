import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
} from '@react-native-firebase/auth';



export const auth = getAuth();



export const loginUser = (
email:string,
password:string
)=>{

return signInWithEmailAndPassword(
auth,
email,
password
);

};





export const registerUser = (
email:string,
password:string
)=>{


return createUserWithEmailAndPassword(
auth,
email,
password
);


};





export const forgotPassword = (
email:string
)=>{


return sendPasswordResetEmail(
auth,
email
);


};





export const logoutUser = ()=>{


return signOut(auth);


};





export const subscribeAuth = (
callback:any
)=>{


return onAuthStateChanged(
auth,
callback
);


};