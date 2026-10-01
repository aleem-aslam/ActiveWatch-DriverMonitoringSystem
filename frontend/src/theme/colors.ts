export const LIGHT_COLORS = {

background:'#F8FAFC',

surface:'#FFFFFF',

card:'#F1F5F9',

text:'#0F172A',

muted:'#64748B',

primary:'#2563EB',

secondary:'#38BDF8',

border:'#CBD5E1',

success:'#22C55E',

danger:'#EF4444'

};



export const DARK_COLORS = {


background:'#08111F',

surface:'#111827',

card:'#1E293B',

text:'#FFFFFF',

muted:'#94A3B8',

primary:'#2563EB',

secondary:'#38BDF8',

border:'#334155',

success:'#22C55E',

danger:'#EF4444'

};


export type ThemeColors = typeof LIGHT_COLORS;


export const getColors = (isDark:boolean)=>{

return isDark
?
DARK_COLORS
:
LIGHT_COLORS;

};


export const COLORS = LIGHT_COLORS;