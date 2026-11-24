import React,{
createContext,
useState
}
from 'react';



export const GuestContext =
createContext<any>(null);



export function GuestProvider({
children
}:any){


const [
guest,
setGuest
]=useState(false);



return(

<GuestContext.Provider

value={{

guest,

continueGuest:
()=>setGuest(true)

}}

>


{children}


</GuestContext.Provider>


);


}