const { initializeApp, cert } =
require("firebase-admin/app");


const { getFirestore, FieldValue } =
require("firebase-admin/firestore");



const serviceAccount =
require("./serviceAccountKey.json");



// Initialize Firebase Admin

initializeApp({

    credential:
    cert(serviceAccount)

});



const db =
getFirestore();





async function migrateUsers(){


    try{


        console.log(
            "Starting Firebase migration..."
        );



        const usersSnapshot =
        await db.collection("users").get();




        if(usersSnapshot.empty){


            console.log(
                "No users found in Firestore"
            );


            return;

        }





        const batch =
        db.batch();





        usersSnapshot.forEach((userDoc)=>{


            const userData =
            userDoc.data();




            console.log(
                "Updating user:",
                userDoc.id
            );




            const userRef =
            db.collection("users")
            .doc(userDoc.id);





            batch.set(

                userRef,

                {


                    uid:
                    userDoc.id,



                    email:
                    userData.email || "",



                    fullName:
                    userData.fullName || "",



                    phone:
                    userData.phone || "",



                    photoURL:
                    userData.photoURL || "",




                    provider:
                    userData.provider || "email",




                    accountStatus:
                    userData.accountStatus || "active",





                    createdAt:

                    userData.createdAt ||

                    FieldValue.serverTimestamp(),





                    lastLogin:

                    FieldValue.serverTimestamp(),







                    driverProfile:{


                        age:
                        userData.driverProfile?.age || "",


                        gender:
                        userData.driverProfile?.gender || "",


                        experienceYears:
                        userData.driverProfile?.experienceYears || 0,


                        licenseNumber:
                        userData.driverProfile?.licenseNumber || "",


                        licenseExpiry:
                        userData.driverProfile?.licenseExpiry || ""


                    },







                    vehicle:{


                        brand:
                        userData.vehicle?.brand || "",


                        model:
                        userData.vehicle?.model || "",


                        year:
                        userData.vehicle?.year || "",


                        registrationNumber:
                        userData.vehicle?.registrationNumber || ""


                    },







                    settings:{


                        theme:
                        userData.settings?.theme || "system",


                        language:
                        userData.settings?.language || "en",


                        alertSound:
                        userData.settings?.alertSound ?? true,


                        vibration:
                        userData.settings?.vibration ?? true,


                        drowsinessSensitivity:
                        userData.settings?.drowsinessSensitivity || 80,


                        accidentDetection:
                        userData.settings?.accidentDetection ?? true


                    },







                    statistics:{


                        totalTrips:
                        userData.statistics?.totalTrips || 0,


                        totalDistance:
                        userData.statistics?.totalDistance || 0,


                        dangerEvents:
                        userData.statistics?.dangerEvents || 0,


                        accidents:
                        userData.statistics?.accidents || 0


                    }





                },


                {

                    merge:true

                }


            );



        });







        await batch.commit();





        console.log(
            "--------------------------------"
        );


        console.log(
            "Firebase migration completed successfully"
        );


        console.log(
            "All users updated"
        );



    }

    catch(error){


        console.error(
            "Migration failed:"
        );


        console.error(error);


    }



}





migrateUsers();