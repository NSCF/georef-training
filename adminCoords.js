//a little utility for testing the addition of coordinates
import admin from 'firebase-admin';
import firebaseConfig from './firebaseConfig.js'
import serviceAccount from './fbAdminServiceAccount.js'


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: firebaseConfig.databaseURL
});

let coords = [
  {
    decimalCoords: '-31.16324878,20.37975424', 
    leader: false,
    uncertaintyUnit: 'km',
    uncertaintyVal: 20
  },
  {
    decimalCoords: '-28.27914566,22.85184263', 
    leader: false,
    uncertaintyUnit: 'km',
    uncertaintyVal: 200
  },
  {
    decimalCoords: '-33.04020478,22.43982790', 
    leader: false,
    uncertaintyUnit: 'km',
    uncertaintyVal: 50
  },
  {
    decimalCoords: '-32.99442536,23.35541619', 
    leader: false,
    uncertaintyUnit: 'km',
    uncertaintyVal: 5
  },
  {
    decimalCoords: '-31.48370468,28.71160769', 
    leader: false,
    uncertaintyUnit: 'km',
    uncertaintyVal: 80
  }
]

let ref = admin.database().ref('georefTraining/georefs')

function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const postCoords = async _ => {
  for(let coord of coords){
    await timeout(1000)
    await ref.push(coord)
    console.log('pushed coords', coord.decimalCoords)
  }

  return
}

postCoords().then(_ => {
  console.log('all done')
  process.exit(0)
})



