// Politique de complexite des mots de passe (cf. cahier des charges 3.3) :
// minimum 8 caracteres + au moins 3 classes parmi
// {minuscule, majuscule, chiffre, caractere special}.

export function validatePasswordPolicy(password: string): string | null {
  if (password.length < 8) {
    return "Le mot de passe doit contenir au moins 8 caracteres.";
  }
  let classes = 0;
  if (/[a-z]/.test(password)) classes++;
  if (/[A-Z]/.test(password)) classes++;
  if (/[0-9]/.test(password)) classes++;
  if (/[^a-zA-Z0-9]/.test(password)) classes++;

  if (classes < 3) {
    return "Le mot de passe doit combiner au moins 3 types parmi : minuscule, majuscule, chiffre, caractere special.";
  }
  return null;
}
