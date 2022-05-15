# Kampiraj u BiH

### Posjetite aplikaciju na: [kampirajubih.herokuapp.com](https://kampirajubih.herokuapp.com)

[//]: # (Komentari:)
[//]: # (Za testiranje koristiti sljedeće pristupne podatke:)

[//]: # (- korisničko ime: **test**)
[//]: # (- lozinka: **test**)
[//]: # (  *ili*)
[//]: # (- korisničko ime: **test2**)
[//]: # (- lozinka: **test2**)

### Screenshot naslovne stranice

![Screenshot naslovne stranice](/public/img/screenshot_bh.png)

### Opis

"Kampiraj u BiH" je internet aplikacija za objavljivanje kampova u Bosni i Hercegovini, pretragu i rezervaciju istih. Koristi geokodiranje, upload slika na Cloudinary, MongoDB bazu u oblaku (MongoDB Atlas) te druge tehnologije.

### Informacije

**Detalji:** Neregistrirani korisnici mogu pretraživati kampove, vidjeti njihove informacije i recenzije. Također, mogu vidjeti i korisničke profile.
Nakon registracije, korisnici mogu dodati novi kamp, ostavljati recenzije na kampove drugih korisnika i zapratiti druge korisnike. Kad neki korisnik doda novi kamp, svi njegovi pratitelji dobiju obavijest. Moguće je također dodati kamp u listu favorita.

**Korišteni alati i tehnologije:** Node.js, Express.js, MongoDB, MongoDB Atlas, HTML5, CSS3, Git, Heroku, Cloudinary.

**Dizajn naslovne stranice:** baziran na predlošku pronađenom na: [HTML5UP](https://html5up.net/alpha).

### Svojstva

**Implementirana svojstva:**

- Prijava / Registracija
- Administratorska uloga
- Promjena lozinke u slučaju zaboravljana iste preko e-maila
- Slanje e-mailova koristeći Nodemailer
- Dodavanje, uređivanje i brisanje kampova
- ~~Google maps - Geokodiranje~~ Prebačeno na Mapbox
- Paginacija
- Flash potvrdne poruke
- Pretraga kampova
- Upload slika koristeći Multer i Cloudinary
- Slug-ovi kampova
- Praćenje korisnika
- Recenzije kampova
- Obavijesti
- Favoriti
- Rezervacija
- Plaćanje