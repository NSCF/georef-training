<script>
	import {onMount} from 'svelte'
	import { Loader as MapsAPILoader } from '@googlemaps/js-api-loader';
	import CoordsInput from './verbatimCoordsInput.svelte'

	import mapsAPIKey from '../keys'

	import firebase from 'firebase/app';
	import 'firebase/database'
	import firebaseConfig from '../firebaseConfig'


	firebase.initializeApp(firebaseConfig);

	let mapcontainer

	let map
	let locality
	let coordsArray = []
	let georefCount = 0
	let verbatimCoords = null
	let decimalCoords
	let uncertaintyVal
	let uncertaintyUnit
	let georefSubmitted = false

	let myMarker

	let iamleader = false //yup, that's what it is...
	let thereIsALeader

	let revealAll = false

	let debouncer

	onMount(async _ => {
		let leaderdiv = document.querySelector('.leader-container')
		leaderdiv.style.visibility ='hidden'
		firebase.database().ref('test').set('this is a test').then(_ => console.log('db value set'))
		firebase.database().ref('georefTraining/leader').get().then(snap => {
			if(!snap.exists || !snap.val()) { //there is no leader
				leaderdiv.style.visibility = 'visible'
			}
			else {
				console.log('there is a leader')
			}
		}).catch(err => {
			console.log('error getting leader flag:', err)
		})

		if (!map) {
			const loader = new MapsAPILoader({
				apiKey: mapsAPIKey,
				version: "weekly"
			}); 
			await loader.load()
		}

		map = new google.maps.Map(mapcontainer, {
			zoom: 5,
			center: {lat: -26.321476, lng: 24.909317}, //TODO set an appropriate coordinate for the region
			disableDoubleClickZoom:true
		});

		//listen for the changes on Firebase

		firebase.database().ref('georefTraining/reveal').on('value', snap => {
			let val = snap.val()
			if(val){
				
				if(myMarker) {
					if(myMarker.circle) {
						myMarker.circle.setMap(null)
						myMarker.circle = null
					}
					myMarker.setMap(null)
					myMarker = null
				}

				revealAll = true
				for (let coord of coordsArray) {
					setTimeout(plotCoords(coord.decimalCoords, map, coord.uncertaintyVal, coord.uncertaintyUnit, false, coord.leader, false), Math.round(Math.random() * 2000))
				}
			}
			else {
				revealAll = false
			}
		})

		firebase.database().ref('georefTraining/leader').on('value', snap => {
			if(snap.val()) {
				thereIsALeader = true
			}
			else {
				thereIsALeader = false
			}
		})

		firebase.database().ref('georefTraining/locality').on('value', snap => {
			
			let val = snap.val()
			if(val && val.trim()){
				//this basically a reset
				locality = val.trim()
				verbatimCoords = null
				decimalCoords = null
				uncertaintyVal = null
				uncertaintyUnit = ""
				georefSubmitted = false
				clearMarkers()
				map.setCenter({lat: -26.321476, lng: 24.909317})
				map.setZoom(5)

			}
		})

		firebase.database().ref('georefTraining/georefs').on('child_added', snap => {
			let coords = snap.val()
			coordsArray.push(coords)
			georefCount++
			
			if(iamleader || revealAll) {
				//update the map
				plotCoords(coords.decimalCoords, map, coords.uncertaintyVal, coords.uncertaintyUnit, false, coords.leader, false)
			}
		})

		//this triggers showing all coords on the map
		firebase.database().ref('georefTraining/showAll').on('value', snap => {
			if(snap.val()){
				for(let coords of coordsArray){
					let latlng = coords.decimalCoords.split(',')
					latlng = {lat: latlng[0], lng: latlng[1]}
					if(!map.LatLngBounds.contains(latlng)) {
						map.LatLngBounds.extent(latlng)
					}
					plotCoords(coords.decimalCoords, map, coords.uncertaintyVal, coords.uncertaintyVal, coords.uncertaintyUnit, false, coords.leader)
				}
			}
		})
	})

	$: uncertaintyVal, uncertaintyUnit, plotCoords(decimalCoords, map, uncertaintyVal, uncertaintyUnit, true, iamleader, true)

	const handleCoords = ev => {
		decimalCoords = ev.detail
		plotCoords(decimalCoords, map, uncertaintyVal, uncertaintyUnit, true, iamleader, true)
	}

	const clearMarkers = _ => {
		if (map && map.markers && map.markers.length) {
			for (let marker of map.markers) {
				if(marker.circle) {
					marker.circle.setMap(null)
					marker.circle = null
				}
				marker.setMap(null)
				marker = null
			}
			coordsArray = []
		}
	}

	const plotCoords = (coords, map, uncertainty, uncertaintyUnit, moveMyMarker, leader, pan) => {
		if(!coords) {
			return
		}

		if(myMarker && moveMyMarker){
			if(myMarker.circle) {
				myMarker.circle.setMap(null)
				myMarker.circle = null
			}
			myMarker.setMap(null)
			myMarker = null
		}
		
		let center = new google.maps.LatLng(...coords.split(','));
		let circle
		let marker = new google.maps.Marker({
			position: center,
			map, 
			icon: {
				path: google.maps.SymbolPath.CIRCLE,
				scale: 5, 
				fillColor: leader? 'blue' : 'green', 
				fillOpacity: 1,
				strokeColor: leader? 'blue' : 'green'
			}, 
			zIndex: 0
		})

		let accuracy = getRadiusM(uncertainty, uncertaintyUnit)

		if(accuracy){
			circle = new google.maps.Circle({
				strokeColor: "#FF0000",
				strokeOpacity: 0.8,
				strokeWeight: 2,
				fillColor: "#FF0000",
				fillOpacity: 0.2,
				center,
				map,
				radius: accuracy, 
				clickable: false,
				visible: true
			});
			marker.circle = circle
		}

		if(map.markers) {
			map.markers.push(marker)
		}
		else {
			map.markers = [marker]
		}

		if(pan) {
			map.panTo(center)
		}
		else {
			let bounds = map.getBounds()
			if(!bounds.contains(center)) {
				bounds.extend(center)
				map.fitBounds(bounds)
			}
		}

		if(moveMyMarker) {
			myMarker = marker
		}
	}

	const getRadiusM = (accuracy, unit) => {
		if (!isNaN(accuracy) && 
			accuracy > 0 &&
			unit && 
			unit.trim() && 
			['m', 'km', 'mi'].includes(unit.toLowerCase())){
			unit = unit.trim().toLowerCase()
			if (unit == 'm'){
				return accuracy
			}
			else if (unit == 'km') {
				return accuracy * 1000
			}
			else { //it's miles
				return Number((accuracy * 1.60934 * 1000).toFixed(2))
			}
		}
		else return 0
	}

	const handleToggleLeader = _ => {
		iamleader = true
		//switch off the listeners because we are now in control...
		firebase.database().ref('georefTraining/reveal').off()
		firebase.database().ref('georefTraining/locality').off()
		firebase.database().ref('georefTraining/showAll').off()

		firebase.database().ref('georefTraining/leader').set(true)
	}

	const handleUnload = _ => {
		if(iamleader){
			firebase.database().ref('georefTraining/leader').set(false)
			firebase.database().ref('georefTraining/reveal').set(false)
		}
	}

	const debounce = v => {
		clearTimeout(debouncer);
		debouncer = setTimeout(() => {
			postLocality();
		}, 750);
	}

	const postLocality = _ => {
		firebase.database().ref('georefTraining/locality').set(locality)
		firebase.database().ref('georefTraining/reveal').set(false)
		firebase.database().ref('georefTraining/georefs').remove()
		clearMarkers()
		map.setCenter({lat: -26.321476, lng: 24.909317})
		map.setZoom(5)
		revealAll = false
		verbatimCoords = null
		decimalCoords = ''
		uncertaintyVal = null
		uncertaintyUnit = ''
		georefSubmitted = false
	}

	const submitGeoref = _ => {
		if(decimalCoords && uncertaintyVal != null && uncertaintyUnit) {
			console.log('submitting georef')
			georefSubmitted = true;

			if(iamleader) {
				map.markers.splice(map.markers.indexOf(myMarker), 1)
			
				if(myMarker.circle) {
					myMarker.circle.setMap(null)
					myMarker.circle = null
				}
				myMarker.setMap(null)
				myMarker = null
			}
			
			firebase.database().ref('georefTraining/georefs').push({
				decimalCoords,
				uncertaintyVal,
				uncertaintyUnit,
				leader: iamleader
			})
		}
		else {
			console.log('uncertaintyunit is', uncertaintyUnit)
			alert('Please add all the fields for the georeference')
		}
		
	}

	const revealGeorefs = _ => {
		firebase.database().ref('georefTraining/reveal').set(true)
		revealAll = true
	}

</script>

<!-- HTML -->
<svelte:window on:beforeunload={handleUnload}/>
<main>
	<h1 class="header">
		Georef training
	</h1>
	{#if iamleader}
		<p class="input-header">Locality string</p>
		<input class="locality" on:keyup={({ target: { value } }) => debounce(value)} bind:value={locality}/>
		<br/>
	{:else}
		{#if !thereIsALeader}
			<div class="leader-container">
				<span class="material-icons checkbox" on:click={handleToggleLeader}>radio_button_unchecked</span>
				<span style="font-size:1.2em;font-weight:bold">Make me the leader!</span>
			</div>
		{/if}
		<p class="input-header">Locality string</p>
		<input class="locality" placeholder="One moment please..." disabled={true} bind:value={locality} />
		<br/>
	{/if}
	<div class="inline-input-block">
		<p class="input-header">Coordinates</p>
		<CoordsInput bind:value={verbatimCoords} on:coords-from-verbatim={handleCoords}/>
		<p class="small-coords">
			{#if decimalCoords }
				{decimalCoords}
			{:else}
				&nbsp;
			{/if}
		</p>
	</div>
	<div class="inline-input-block">
		<p class="input-header">Uncertainty</p>
		<input type="number" min="0" disabled={georefSubmitted} bind:value={uncertaintyVal} />
		<select disabled={georefSubmitted} bind:value={uncertaintyUnit} >
			<option value=""></option>
			<option value="m" >m</option>
			<option value="km">km</option>
		</select>
		<p class="small-coords">&nbsp;</p>
	</div>
	<div class="btn-flex">
		<button class="action-btn" disabled={georefSubmitted} on:click={submitGeoref}>Submit my georef</button>
		{#if iamleader}
			<button class="action-btn" disabled={!georefCount || revealAll} on:click={revealGeorefs}>Reveal georefs</button>
		{/if}
	</div>
	<div class="mapcontainer" bind:this={mapcontainer}></div>
</main>

<style>
	main {
		margin-left:200px
	}
	.header {
		margin-top: 100px;
		font-size: 4em;
		font-variant: small-caps;
		color: grey;
	}

	.leader-container {
		display:flex;
		align-items:center;
		margin-bottom: 20px;;
	}

	.checkbox {
		font-size:2em;
		color:grey;
		margin-right:10px;
	}

	.checkbox:hover {
		cursor: pointer;
		color: darkslategray;
	}

	.action-btn {
		position:relative;
		top: 5px;
		font-size: 1.5em;
		color: rgb(82, 82, 82);
		background-color: #d3edde;
		margin:0;
		
	}

	.action-btn:hover {
		cursor: pointer;
	}

	.action-btn:disabled {
		background-color: #c5c5c5;
	}

	.action-btn:hover:disabled {
		cursor: auto;
	}

	.locality {
		font-size: 1.2em;
		color: rgb(206, 91, 91);
		margin-top:0;
		width:100%;
		border-radius:4px;
		padding: 0.5em;
		border: 2px solid lightgray;
	}

	.input-header{
		margin:0;
		color:rgb(153, 152, 152);
		font-variant: small-caps;
	}

	.small-coords {
		margin:0;
		font-size:0.8em;
		color:rgb(153, 152, 152);
	}

	.inline-input-block{
		display:inline-block;
	}

	input {
		width: 100px;
	}

	input, select {
		font-size:1.5em;
		vertical-align: middle;
		margin-bottom:0;
	}

	.btn-flex {
		display:flex;
		justify-content: space-between;
	}

	.mapcontainer {
		margin-top:20px;
		height:500px;
		width: 100%;
	}
</style>

 

 