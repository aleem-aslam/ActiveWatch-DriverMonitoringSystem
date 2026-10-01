import React, {
  createContext,
  useContext,
  useState,
  ReactNode
} from 'react';


import {
  useColorScheme
} from 'react-native';


import {
  getColors,
  ThemeColors
} from './colors';



interface ThemeContextType {

  mode: 'light' | 'dark';

  colors: ThemeColors;

  toggleTheme: () => void;

}



const ThemeContext =
createContext<ThemeContextType | undefined>(
  undefined
);




interface ThemeProviderProps {

  children: ReactNode;

}



export function ThemeProvider({
  children
}: ThemeProviderProps) {



  const systemMode =
  useColorScheme();



  const [mode, setMode] =
  useState<'light' | 'dark'>(
    systemMode === 'dark'
      ? 'dark'
      : 'light'
  );




  const toggleTheme = () => {


    setMode(previous =>
      previous === 'dark'
        ? 'light'
        : 'dark'
    );


  };




  const colors =
  getColors(
    mode === 'dark'
  );




  return (

    <ThemeContext.Provider

      value={{

        mode,

        colors,

        toggleTheme

      }}

    >

      {children}


    </ThemeContext.Provider>


  );


}





export function useTheme(){



  const context =
  useContext(
    ThemeContext
  );



  if(!context){


    throw new Error(
      'useTheme must be used inside ThemeProvider'
    );


  }



  return context;


}