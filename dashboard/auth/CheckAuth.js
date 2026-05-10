module.exports = (req, res, next) => {
  // Eğer oturum (session) varsa ve kullanıcı giriş yapmışsa devam et
  if (req.session && req.session.user) {
    return next();
  }

  // Eğer giriş yapmamışsa, girmeye çalıştığı linki hafızaya al (hata vermemesi için kontrol ekledik)
  if (req.session) {
    req.session.backURL = req.url;
  }

  // Giriş yapmadığı için ana sayfaya yönlendir
  res.redirect("/");
};