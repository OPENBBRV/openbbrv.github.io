const state = {

data:null,

selectedRule:null,
selectedError:null,

hideWaived:false,
search:"",

waived:new Set(),
fixed:new Set(),

expandedRules:new Set()

}


// UI EVENTS

document.getElementById("fileInput")
.addEventListener("change", loadFile)

document.getElementById("searchRule")
.addEventListener("input", e=>{
state.search = e.target.value.toLowerCase()
renderRules()
})

document.getElementById("hideWaived")
.addEventListener("change", e=>{
state.hideWaived = e.target.checked
renderRules()
})

document.getElementById("waiveBtn").onclick = ()=>{
if(!state.selectedRule) return
state.waived.add(state.selectedRule.name)
renderRules()
}

document.getElementById("unwaiveBtn").onclick = ()=>{
if(!state.selectedRule) return
state.waived.delete(state.selectedRule.name)
renderRules()
}

document.getElementById("fixedBtn").onclick = ()=>{
if(!state.selectedRule) return
state.fixed.add(state.selectedRule.name)
renderRules()
}



function loadFile(e){

const file = e.target.files[0]

const reader = new FileReader()

reader.onload = ev => {

state.data = parseDRC(ev.target.result)

console.log("Parsed DRC JSON")
console.log(JSON.stringify(state.data,null,2))

updateHeader()
renderRules()

}

reader.readAsText(file)

}



function updateHeader(){

document.getElementById("cellName").innerText = state.data.cell

let total = 0

state.data.rules.forEach(r=> total += r.errors.length)

document.getElementById("errorCount").innerText = total

}



function parseDRC(text){

const lines = text.split("\n").map(l=>l.trim())

let index = 0

const [cell,scale] = lines[index++].split(" ")

const data = {
cell,
scale:Number(scale),
rules:[]
}


while(index < lines.length){

let line = lines[index]

if(!line.startsWith("GR")){
index++
continue
}

const rule = {
name:line,
description:"",
errors:[]
}

index++
index +=3

rule.description = lines[index++]

while(lines[index]?.startsWith("Note") ||
lines[index]?.startsWith("HINT")){

rule.description += " " + lines[index++]

}



while(
lines[index]?.startsWith("e") ||
lines[index]?.startsWith("p")
){

const parts = lines[index].split(/\s+/)

const type = parts[0]

const id = parts.slice(1).join(" ")

index++

let transform = null
let cellName = data.cell

const coords = []



while(
index < lines.length &&
!lines[index].startsWith("e") &&
!lines[index].startsWith("p") &&
!lines[index].startsWith("GR")
){

let line = lines[index]



if(line.startsWith("CN")){

const p = line.split(/\s+/)

cellName = p[1]

transform = [
Number(p[3]),
Number(p[4]),
Number(p[5]),
Number(p[6]),
Number(p[7]),
Number(p[8])
]

index++
continue
}



const nums = line
.split(/\s+/)
.map(Number)

if(nums.length >= 4 && nums.every(n => !isNaN(n))){

let coord = nums

if(transform){
coord = transformCoord(coord,transform)
}

coords.push(coord)

}

index++

}



rule.errors.push({
type,
id,
cell:cellName,
coords
})

}

data.rules.push(rule)

}

return data

}



function transformCoord(coord,transform){

const [a,b,c,d,tx,ty] = transform

const result = []

for(let i=0;i<coord.length;i+=2){

const x = coord[i]
const y = coord[i+1]

result.push(
a*x + b*y + tx,
c*x + d*y + ty
)

}

return result

}



function renderRules(){

const panel = document.getElementById("leftPanel")

panel.innerHTML=""

state.data.rules
.filter(rule=>{

if(state.hideWaived && state.waived.has(rule.name))
return false

if(state.search &&
!rule.name.toLowerCase().includes(state.search))
return false

return true

})

.forEach(rule=>{

const div = document.createElement("div")

div.className="rule"

if(state.waived.has(rule.name))
div.classList.add("waived")

div.innerText = `${rule.name} (${rule.errors.length})`

div.onclick = ()=>{

if(state.expandedRules.has(rule.name)){
state.expandedRules.delete(rule.name)
}else{
state.expandedRules.add(rule.name)
}

state.selectedRule = rule

renderRules()
renderDescription()

}

panel.appendChild(div)



if(state.expandedRules.has(rule.name)){

rule.errors.forEach(err=>{

const e = document.createElement("div")

e.className="error"

if(state.selectedError === err){
    e.classList.add("error-selected")
}

e.innerText=`${err.type} ${err.id} (${err.cell})`

e.onclick=()=>{

state.selectedError = err

renderRules()   // refresca highlight
renderCoords()

}

panel.appendChild(e)

})

}

})

}



function renderCoords(){

const scale = state.data.scale

const err = state.selectedError

if(!err) return

const coords = err.coords.map(group=>
group.map(c => (c/scale).toFixed(4)).join(" , ")
)

document.getElementById("coords").innerText =
`Cell: ${err.cell}

` + coords.join("\n")

}



function renderDescription(){

if(!state.selectedRule) return

document.getElementById("ruleDescription")
.innerText = state.selectedRule.description

}