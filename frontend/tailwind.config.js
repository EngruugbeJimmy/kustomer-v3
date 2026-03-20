/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  theme: { extend: {
    colors: {
      kgreen: { 900:"#063d26",800:"#0a5c38",700:"#0a7a4b",600:"#0e9559",500:"#13b068",100:"#d4f5e5",50:"#eafbf3" },
      kgold:  { 700:"#a37000",500:"#d4a017",300:"#f0c84a",100:"#fff3c4",50:"#fffae8" },
    },
    fontFamily: { display:['"Plus Jakarta Sans"',"sans-serif"], body:['"DM Sans"',"sans-serif"] }
  }},
  plugins: []
}
