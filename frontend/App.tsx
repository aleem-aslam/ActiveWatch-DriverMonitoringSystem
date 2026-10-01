import React from "react";


import {
NavigationContainer
}
from "@react-navigation/native";


import RootNavigator
from "./src/navigation/RootNavigator";


import {
AuthProvider
}
from "./src/context/AuthContext";


import {
ThemeProvider
}
from "./src/theme/ThemeContext";





export default function App(){


return(


<ThemeProvider>


<AuthProvider>


<NavigationContainer>


<RootNavigator/>


</NavigationContainer>


</AuthProvider>


</ThemeProvider>


);


}