const state = {

data:null,

selectedRule:null,
selectedError:null,
selectedCell:null,

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

const lines = text
.replace(/\r/g,"")
.split("\n")
.map(l => l.trim())
.filter(Boolean)

let index = 0

const [cell,scale] = lines[index].split(/\s+/)

index++

const data = {
cell,
scale:Number(scale),
rules:[]
}

let currentRule = null
let currentError = null
let transform = null
let cellName = cell


while(index < lines.length){

const line = lines[index]


/* ---------- RULE ---------- */

if(line.startsWith("GR")){

currentRule = {
name:line,
description:"",
errors:[]
}

data.rules.push(currentRule)

index++

/* skip metadata */
index += 3

if(lines[index])
currentRule.description = lines[index++]

while(/^Note|^HINT/.test(lines[index] || "")){
currentRule.description += " " + lines[index++]
}

continue
}



/* ---------- ERROR ---------- */

if(/^[ep]\s/.test(line)){

const parts = line.split(/\s+/)

currentError = {
type:parts[0],
id:parts.slice(1).join(" "),
cell:cellName,
transform,
coords:[]
}

currentRule.errors.push(currentError)

index++
continue
}



/* ---------- SUBCELL ---------- */

if(/^CN\s/.test(line)){

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

if(currentError)
currentError.cell = cellName

index++
continue
}



/* ---------- COORDINATES ---------- */

const nums = line
.split(/\s+/)
.map(Number)

if(
currentError &&
nums.length >= 2 &&
nums.every(Number.isFinite)
){

let coord = nums

if(transform){
coord = transformCoord(coord,transform)
}

currentError.coords.push(coord)

}


index++

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

if(state.selectedRule === rule)
div.classList.add("rule-selected")

if(state.waived.has(rule.name))
div.classList.add("waived")

// select rule on row click
div.onclick = ()=>{
    state.selectedRule = rule

    // only clear if error does NOT belong to this rule
    if(!rule.errors.includes(state.selectedError)){
        state.selectedError = null
        document.getElementById("coords").innerText = ""
    }

    renderRules()
    renderDescription()
}

// row container
const row = document.createElement("div")
row.className = "rule-row"

// expand / collapse button
const btn = document.createElement("button")
btn.className = "expand-btn"
btn.innerText = state.expandedRules.has(rule.name) ? "▾" : "▸"

btn.onclick = (ev)=>{
ev.stopPropagation()

if(state.expandedRules.has(rule.name)){
state.expandedRules.delete(rule.name)
}else{
state.expandedRules.add(rule.name)
}

renderRules()
}

// label
const label = document.createElement("span")
label.innerText = `${rule.name} (${rule.errors.length})`

row.appendChild(btn)
row.appendChild(label)

div.appendChild(row)
panel.appendChild(div)

if(state.expandedRules.has(rule.name)){

rule.errors.forEach(err=>{

const e = document.createElement("div")
e.className="error"

if(state.selectedError === err){
e.classList.add("error-selected")
}

e.innerText=`${err.type} ${err.id} (${err.cell})`

e.onclick=(ev)=>{

ev.stopPropagation()

state.selectedError = err
state.selectedRule = rule

renderRules()
renderCoords()
renderDescription()

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

//Keyboard navigation

document.addEventListener("keydown", (e)=>{

// ignore typing in inputs
if(["INPUT","TEXTAREA"].includes(document.activeElement.tagName))
return

// nothing selected → do nothing
if(!state.selectedRule) return

const errors = state.selectedRule.errors

// ↓ next error
if(e.key === "ArrowDown"){

e.preventDefault()

if(!errors.length) return

let idx = errors.indexOf(state.selectedError)

// if none selected → go first
if(idx === -1) idx = 0
else idx = Math.min(idx + 1, errors.length - 1)

state.selectedError = errors[idx]

// ensure expanded
state.expandedRules.add(state.selectedRule.name)

renderRules()
renderCoords()
renderDescription()
}

// ↑ previous error
if(e.key === "ArrowUp"){

e.preventDefault()

if(!errors.length) return

let idx = errors.indexOf(state.selectedError)

// if none selected → go last
if(idx === -1) idx = errors.length - 1
else idx = Math.max(idx - 1, 0)

state.selectedError = errors[idx]

state.expandedRules.add(state.selectedRule.name)

renderRules()
renderCoords()
renderDescription()
}

// W → waive/unwaive rule
if(e.key.toLowerCase() === "w"){

e.preventDefault()

const name = state.selectedRule.name

if(state.waived.has(name)){
state.waived.delete(name)
}else{
state.waived.add(name)
}

renderRules()
renderDescription()
}

})