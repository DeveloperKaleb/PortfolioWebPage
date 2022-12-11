const buttonSpace = document.querySelector(".butMania");

const colorArray = [
  'white',
  'black',
  'red',
  'green'
];
  
let renderHtml = '';

function renderButtons(width, height, html, row = 1, column = 1) {
  if (row > height) {
    buttonSpace.innerHTML = html;
    return;
  }

  renderHtml = renderHtml.concat(`<div class="y${row}">`)
  while (column <= width) {
    renderHtml += `<button class="x${column}y${row}" style="background-color: white"></button>`
    column += 1;
  }
  renderHtml = renderHtml.concat('</div>')

  row += 1;
  renderButtons(width, height, renderHtml, row);
}

function displayArray(event) {
  event.preventDefault()

  const columns = document.getElementById('xVal').value
  const rows = document.getElementById('yVal').value

  renderButtons(rows, columns, renderHtml);

  buttonSpace.addEventListener("click", (event) => {
    const clickedClass = event.target.className;
    
    const isNotRow = clickedClass.split('').includes('x');
    if (!isNotRow) {
      return
    }
  
    const clickedElement = document.querySelector(`.${clickedClass}`)
    const buttonBackColor = clickedElement.style.backgroundColor;
  
    if (buttonBackColor && buttonBackColor === 'white') {
      clickedElement.style.backgroundColor = 'black';
    } else {
      clickedElement.style.backgroundColor = 'white';
    }
  });
}