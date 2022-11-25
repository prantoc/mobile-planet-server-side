//# all required 
const express = require('express')
const app = express()
var cors = require('cors')
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');

//#port setup
const port = process.env.PORT || 5000
//# used cors
app.use(cors())
//# json req body parser 
app.use(express.json())


//# MongoDb Setup
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.7incky7.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


//# JWT Access Token verify
function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unathorized Access !' })
    }

    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden Access!' })
        }
        req.decoded = decoded
        next()
    });
}


async function run() {
    try {
        const DB = client.db("mobilePlanet");
        const categoryCollection = DB.collection("categories");
        const usersCollection = DB.collection("user")
        const productsCollection = DB.collection("products")

        //# JWT Access Token Create
        app.get('/jwt', async (req, res) => {
            const email = req.query.email
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' });
                return res.send({ accessToken: token })
            }
            res.status(403).send({ accessToken: '' })

        })


        //# Users
        //* User role check 
        //! after verify jwtVerify it will be ran 
        const verifyAdmin = async (req, res, next) => {
            const decodedEmail = req.decoded.email
            const id = req.params.id
            const query = { email: decodedEmail }
            const isAdmin = await usersCollection.findOne(query)
            if (isAdmin.role !== 'admin') {
                return res.status(403).send({ message: 'Forbidden Access!' })
            }
            next()
        }



        //* User create api
        app.post('/users', async (req, res) => {
            const user = req.body
            const result = await usersCollection.insertOne(user);
            res.send(result)
        })
        //* Admin role check api
        app.get('/users/admin/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            res.send({ isAdmin: user?.role === 'admin' })
        })
        //* Admin seller check api
        app.get('/users/seller/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            res.send({ isSeller: user?.role === 'seller' })
        })


        //# Category
        //* Add category api
        app.post('/add-category', verifyJWT, verifyAdmin, async (req, res) => {
            const data = req.body
            const result = await categoryCollection.insertOne(data)
            res.send(result)
        })

        //* Get category api
        app.get('/category', async (req, res) => {
            const result = await categoryCollection.find({}).sort({ _id: -1 }).toArray();
            res.send(result)
        })

        //* Delete category api
        app.delete('/category/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await categoryCollection.deleteOne(query);
            res.send(result)
        })



        //# Product
        //* Add product api
        app.post('/add-product', verifyJWT, async (req, res) => {
            const data = req.body
            const result = await productsCollection.insertOne(data)
            res.send(result)
        })



    } finally {
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Mobile Planet server is runing!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})