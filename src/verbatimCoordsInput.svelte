<script>
import convert from 'geo-coordinates-parser'
import {createEventDispatcher} from 'svelte'
export let value = null
export let hasError = false

let dispatch = createEventDispatcher()

const pasteVerbatimCoords = _ => {
  if(navigator.clipboard.readText) {
    navigator.clipboard.readText().then(coordsString => {
      try {
        let decimalCoords = calcDecimalCoords(coordsString)
        value = coordsString.trim()
        dispatch('coords-from-verbatim', decimalCoords)
      }
      catch(err){
        alert(err.message)
      }
    })
  }
  else {
    alert('this browser does not support programmatic copy/paste')
  }
}

const handleInputPasteCoords = ev => {
  ev.preventDefault()
  let pasteData = ev.clipboardData.getData("text")
  try {
    let decimalCoords = calcDecimalCoords(pasteData)
    value = pasteData.trim()
    dispatch('coords-from-verbatim', decimalCoords)
  }
  catch(err){
    alert(err.message)
  }
}

//this throws if any problem at all
const calcDecimalCoords = coordsString => {
  if(coordsString && coordsString.trim()){
    coordsString = coordsString.trim()
    try {
      let converted = convert(coordsString)

      return `${converted.decimalLatitude},${converted.decimalLongitude}`   
    }
    catch(err) {
      if (coordsString.length > 30) {
        coordsString = coordsString.slice(0,30) + '...'
      }
      coordsString = coordsString.replace(/\s+/g, ' ')
      coordsString = '"' + coordsString + '"'
      throw new Error('invalid verbatim coords string: ' + coordsString)
    }
  }
  else {
    throw new Error('empty coordinates string')
  }
}
</script>

<!-- ############################################## -->
<!-- HTML -->
<div class="icon-input-container">
    <input type="text" class="icon-input" class:hasError readonly on:paste={handleInputPasteCoords} bind:value>
    <span class="material-icons inline-icon icon-input-icon" style="right:5px" title="paste coords" on:click={pasteVerbatimCoords}>content_paste</span>
</div>

<!-- ############################################## -->
<style>

.icon-input-container {
  display: inline-block;
  position:relative;
  width: min-content;
}

.icon-input {
  padding-right: 40px;
  font-size:1.5em;
  width: 350px;
  vertical-align: middle;
  margin-bottom:0;
}

.icon-input-icon {
  position:absolute;
  bottom:15px; /* becuase the default bottom margin for an input is 8*/
  /* no right property, that must go into the inline style for the element */
  width:24px;
  height:24px;
  color: grey;
}

.icon-input-icon:hover {
  cursor: pointer;
  color: darkslategray;
}

.hasError {
  border: 1px solid rgb(133, 49, 34);
  background-color: rgb(255, 155, 155)
}
</style>