const CLEVEL = ["ceo","cto","coo","cfo","cmo","cso","cpo","diretor","co-founder","founder","sócio","presidente","vp"];

export function hasFullAccess(user) {
  if (!user) return false;
  if (user.role === "c4hub_admin") return true;
  const cargo = (user.cargo || "").toLowerCase();
  return CLEVEL.some(c => cargo.includes(c));
}
