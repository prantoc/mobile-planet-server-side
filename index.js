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


//# This is your test secret API key.
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)

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
        const bookingProductCollection = DB.collection("bookingProduct")
        const wishlistCollection = DB.collection("wishlistProduct")
        const paymentCollection = DB.collection("payment")

        //# JWT Access Token Create
        app.get('/jwt', async (req, res) => {
            const email = req.query.email
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user) {
                const token = jwt.sign({ email }, process.env.ACCESS_TOKEN);
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

        //* Specific user data get api
        app.get('/user/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            res.send(user)
        })

        //* get api for all users
        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.query.email;
            const query = { email: { $nin: [email] } }  //! get all users data except admin data
            const user = await usersCollection.find(query).sort({ _id: -1 }).toArray();
            res.send(user)
        })

        //* Verified user api
        app.put('/users/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const user = await usersCollection.findOne(query);
            const filter = { sellerEmail: user.email }
            const updateDoc = {
                $set: {
                    verified: !user.verified
                },
            };
            const updateProduct = {
                $set: {
                    verifiedSeller: !user.verified
                },
            };
            await productsCollection.updateMany(filter, updateProduct);
            const result = await usersCollection.updateOne(query, updateDoc);
            res.send(result)
        })

        //* Delete users api
        app.delete('/users/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await usersCollection.deleteOne(query);
            res.send(result)
        })


        //* Admin role check api
        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            res.send({ isAdmin: user?.role === 'admin' })
        })
        //*  Seller role check api
        app.get('/users/seller/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            res.send({ isSeller: user?.role === 'seller' })
        })
        //* Get seller all buyers
        app.get('/buyersList', verifyJWT, async (req, res) => {
            const email = req.query.email
            const filter = { sellerEmail: email }
            const result = await bookingProductCollection.find(filter).sort({ _id: -1 }).toArray();
            res.send(result)
        })

        //# Category
        //* Add category api
        app.post('/add-category', verifyJWT, verifyAdmin, async (req, res) => {
            const data = req.body
            const result = await categoryCollection.insertOne(data)
            res.send(result)
        })

        //* Delete category api
        app.delete('/category/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await categoryCollection.deleteOne(query);
            res.send(result)
        })

        //* Get category name only
        app.get('/category-name', verifyJWT, async (req, res) => {
            const result = await categoryCollection.find({}).project({ categoryName: 1 }).toArray()
            res.send(result)
        })

        //# Product
        //* Add product api
        app.post('/add-product', verifyJWT, async (req, res) => {
            const data = req.body
            const result = await productsCollection.insertOne(data)
            res.send(result)
        })

        //* Get products api
        app.get('/product/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            let result = '';
            if (user.role === 'admin') {
                result = await productsCollection.find({}).sort({ _id: -1 }).toArray();
            } else {
                const filter = { sellerEmail: email }
                result = await productsCollection.find(filter).sort({ _id: -1 }).toArray();
            }
            res.send(result)
        })
        //* Approve product for listing api
        app.put('/product/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const product = await productsCollection.findOne(query);
            const updateDoc = {
                $set: {
                    displayListing: !product.displayListing
                },
            };
            const result = await productsCollection.updateOne(query, updateDoc);
            res.send(result)
        })
        //* Product advertise api
        app.get('/productAdvertise/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const product = await productsCollection.findOne(query);
            const value = product.advertise === 'pending' ? false : true;
            const updateDoc = {
                $set: {
                    advertise: value
                },
            };
            const result = await productsCollection.updateOne(query, updateDoc);
            res.send(result)
        })

        //* Delete product api
        app.delete('/product/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await productsCollection.deleteOne(query);
            res.send(result)
        })

        //! Common Apis----------------------------------------------
        //? category api
        //* Get categories api
        app.get('/category', async (req, res) => {
            const result = await categoryCollection.find({}).sort({ _id: -1 }).toArray();
            res.send(result)
        })
        //! Frontend Apis----------------------------------------------
        //? User data store from frontned
        //* User create api
        app.post('/users', async (req, res) => {
            const user = req.body

            const userEmail = await usersCollection.findOne({ email: user.email })
            if (!userEmail) {
                const result = await usersCollection.insertOne(user);
                res.send(result)
            }
            // res.send('Already')

        })

        //? Product data frontned
        //* Get products by category id api
        app.get('/category/:name', async (req, res) => {
            const categoryName = req.params.name
            const filter = { productCategory: categoryName, displayListing: true }
            const result = await productsCollection.find(filter).sort({ _id: -1 }).toArray();
            res.send(result)
        })

        //* Get single product details api
        app.get('/product-details/:id', async (req, res) => {
            const id = req.params.id
            const filter = { _id: ObjectId(id), displayListing: true }
            const result = await productsCollection.findOne(filter);
            res.send(result)
        })

        //* Show advertise product only
        app.get('/advertiseProducts', async (req, res) => {
            const result = await productsCollection.find({ advertise: true, displayListing: true }).toArray()
            res.send(result)
        })

        //? Buyer  data frontned
        //* book a product api
        app.post('/book-product', verifyJWT, async (req, res) => {
            const data = req.body
            const result = await bookingProductCollection.insertOne(data)
            res.send(result)
        })
        //* Add to wishlist a product
        app.put('/addToWishlistProduct', verifyJWT, async (req, res) => {
            const id = req.query.id;
            const productName = req.query.name;
            const productImg = req.query.img;
            const productPrice = req.query.price;
            const email = req.decoded.email
            const query = { productId: id, buyerEmail: { $eq: { email } } }
            const wlp = await wishlistCollection.findOne(query); // wlp = wishlistProduct
            let data = { productId: id, wishlist: true, buyerEmail: email, productName, productImg, productPrice, paid: false }
            if (!wlp) {
                const result = await wishlistCollection.insertOne(data);
                return res.send(result)
            }
            const updateDoc = {
                $set: {
                    wishlist: !wlp.wishlist
                },
            };
            const result = await wishlistCollection.updateOne(query, updateDoc);
            res.send(result)
        })

        //* Get specific product wishlist status api 
        app.get('/wishlistProduct', verifyJWT, async (req, res) => {
            const id = req.query.id;
            const email = req.decoded.email
            const query = { productId: id, buyerEmail: email }
            const result = await wishlistCollection.findOne(query);
            if (!result) {
                return res.send({ message: 'no data avaiable' })
            }
            res.send(result)
        })
        //* Get wishlisted products api
        app.get('/wishlistedProducts', verifyJWT, async (req, res) => {
            const email = req.decoded.email
            const filter = { buyerEmail: email, wishlist: true }
            const wishlist = await wishlistCollection.find(filter).sort({ _id: -1 }).toArray();
            return res.send(wishlist)
        })
        //* remove wishlist products api
        app.get('/removeWishlistProduct/:id', verifyJWT, async (req, res) => {
            const email = req.decoded.email
            const id = req.params.id
            const filter = { buyerEmail: email, _id: ObjectId(id) }

            const updateDoc = {
                $set: {
                    wishlist: false
                },
            };

            const wishlist = await wishlistCollection.updateOne(filter, updateDoc);
            return res.send(wishlist)
        })
        //* Get booked products api
        app.get('/bookedProducts', verifyJWT, async (req, res) => {
            const email = req.query.email
            const filter = { buyerEmail: email }
            const result = await bookingProductCollection.find(filter).sort({ _id: -1 }).toArray();
            res.send(result)
        })
        //* Get specific booked product api
        app.get('/bookedProduct', async (req, res) => {
            const email = req.query.email
            const id = req.query.id
            const filter = { buyerEmail: email, productId: id }
            const result = await bookingProductCollection.findOne(filter);
            if (!result) {
                return res.send({ message: 'no data avaiable' })
            }
            res.send(result)
        })

        //? Buyer payemnt Strip api
        //* payment intent api 
        app.post("/create-payment-intent", async (req, res) => {
            const booking = req.body;
            const price = booking.resellPrice
            const amount = price * 100;

            // Create a PaymentIntent with the order amount and currency
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                "payment_method_types": [
                    "card"
                ],
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });

        //* Store payment details api
        app.post('/payments', async (req, res) => {
            const paymentData = req.body
            const result = await paymentCollection.insertOne(paymentData)
            const id = paymentData.id
            console.log(id);
            const query = { _id: ObjectId(id) }
            const filter = { _id: ObjectId(paymentData.productId) }
            const queryWishlist = { productId: paymentData.productId }
            const updateDoc = {
                $set: {
                    paid: true
                },
            };
            const upd = {
                $set: {
                    displayListing: false
                },
            };
            await bookingProductCollection.updateOne(query, updateDoc)
            await productsCollection.updateOne(filter, upd)
            await wishlistCollection.updateOne(queryWishlist, updateDoc)
            res.send(result)
        })
        //* Get specific product payment details api
        app.get('/paymentProduct', verifyJWT, async (req, res) => {
            const id = req.query.id
            const filter = { productId: id }
            const result = await paymentCollection.findOne(filter);
            if (!result) {
                return res.send({ message: 'no data avaiable' })
            }
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