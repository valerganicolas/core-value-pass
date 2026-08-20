const themes = {
  saints: {
    label: 'Saints',
    className: 'theme-saints',
    primary: 'https://lightgreen-whale-804521.hostingersite.com/wp-content/uploads/2026/08/SAINTS_WEB.png',
    primaryAlt: 'New Orleans Saints logo',
    secondary: null,
    secondaryAlt: ''
  },
  pelicans: {
    label: 'Pelicans /Squadron',
    className: 'theme-pelicans',
    primary: 'https://lightgreen-whale-804521.hostingersite.com/wp-content/uploads/2026/08/PELS_WEB.png',
    primaryAlt: 'New Orleans Pelicans logo',
    secondary: 'https://lightgreen-whale-804521.hostingersite.com/wp-content/uploads/2026/08/SQUADRON_WEB.png',
    secondaryAlt: 'Birmingham Squadron logo'
  },
  city: {
    label: 'City Edition',
    className: 'theme-city',
    primary: 'assets/city-edition-logo.png',
    primaryAlt: 'Pelicans City Edition logo',
    secondary: null,
    secondaryAlt: ''
  },
  benson: {
    label: 'Benson Enterprises',
    className: 'theme-benson',
    primary: 'https://lightgreen-whale-804521.hostingersite.com/wp-content/uploads/2026/08/BENSON_WH_WEB_2.png',
    primaryAlt: 'Benson Enterprises logo',
    secondary: null,
    secondaryAlt: ''
  }
};

const tabs = [...document.querySelectorAll('.theme-tab')];
const pass = document.getElementById('values-pass');
const primaryLogo = document.getElementById('brand-logo-primary');
const secondaryLogo = document.getElementById('brand-logo-secondary');
const brandName = document.getElementById('pass-brand-name');
const toast = document.getElementById('toast');
let toastTimer;
let currentTheme = 'saints';

function setTheme(themeKey, persist = true) {
  const theme = themes[themeKey] || themes.saints;
  currentTheme = themeKey in themes ? themeKey : 'saints';
  pass.classList.remove('theme-saints', 'theme-pelicans', 'theme-city', 'theme-benson');
  pass.classList.add(theme.className);

  primaryLogo.src = theme.primary;
  primaryLogo.alt = theme.primaryAlt;
  brandName.textContent = theme.label;

  if (theme.secondary) {
    secondaryLogo.src = theme.secondary;
    secondaryLogo.alt = theme.secondaryAlt;
    secondaryLogo.classList.remove('hidden');
  } else {
    secondaryLogo.removeAttribute('src');
    secondaryLogo.alt = '';
    secondaryLogo.classList.add('hidden');
  }

  tabs.forEach(tab => {
    const active = tab.dataset.theme === currentTheme;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  if (persist) localStorage.setItem('coreValuesTheme', currentTheme);
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

tabs.forEach(tab => tab.addEventListener('click', () => setTheme(tab.dataset.theme)));

document.querySelectorAll('.wallet-button').forEach(button => {
  button.addEventListener('click', () => {
    if (button.dataset.wallet === 'google') {
      const link = window.GOOGLE_WALLET_LINKS?.[currentTheme];
      if (link) {
        window.location.href = link;
      } else {
        showToast('Google Wallet is ready for issuer setup.');
      }
      return;
    }

    showToast('Apple Wallet connection is the next step.');
  });
});

const stored = localStorage.getItem('coreValuesTheme');
if (stored && themes[stored]) setTheme(stored, false);
else setTheme('saints', false);
