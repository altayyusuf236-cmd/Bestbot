module.exports = (req, res, next) => {
  // Eğer kullanıcı session'da varsa devam et
  if (req.session && req.session.user) {
    return next();
  }
  
  // Yoksa ana sayfaya at (Giriş yapması için)
  // BURAYA DİKKAT: Eğer zaten ana sayfadaysan yönlendirme yapma (Döngü durur)
  if (req.url === "/") return next();
  
  res.redirect("/");
};