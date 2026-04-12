// The name of my GitHub repository
const basePath = '/PortfolioWebPage';

const navTemplate = `
<nav>
  <a href="${basePath}/" id="nav-home">Home</a>
  <a href="${basePath}/entertainment/entertainment.html" id="nav-entertainment">Entertainment</a>
</nav>
`;

document.addEventListener("DOMContentLoaded", () => {
    const navElement = document.getElementById('global-nav');
    if (navElement) {
        navElement.innerHTML = navTemplate;
    }
    
    // Active link highlighting
    const currentPath = window.location.pathname;
    if (currentPath === `${basePath}/` || currentPath === `${basePath}/index.html`) {
        document.getElementById('nav-home')?.classList.add('active');
    } else if (currentPath.includes('/entertainment/')) {
        document.getElementById('nav-entertainment')?.classList.add('active');
    }
});