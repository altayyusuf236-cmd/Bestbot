module.exports = (req, res, next) => {
  if (req.session && req.session.user) return next();
  
  // Eğer zaten ana sayfadaysak yönlendirme yapıp döngüye girme
  if (req.path === "/" || req.path === "/api/auth/callback") return next();
  
  return res.redirect("/");
};