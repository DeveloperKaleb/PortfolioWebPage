const buttonSpace = document.querySelector(".butMania");
const main = document.getElementById('main');

const colorArray = [
  'white',
  'black',
  'red',
  'green'
];
  
let renderHtml = '';
let colorPickerRendered = false;

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

  renderHtml = '';
  renderButtons(columns, rows, renderHtml);

  // the eventListener below needs the value from the colorPicker, so the colorPicker is rendered first
  if (!colorPickerRendered){
    const colorPickerForm = document.createElement('form');
    colorPickerForm.innerHTML = '<select id="colorPicker"><option value="black">Black</option><option value="white">White</option><option value="red">Red</option><option value="green">Green</option><option value="purple">Purple</option><option value="pink">Pink</option><option value="yellow">Yellow</option></select>';

    main.insertBefore(colorPickerForm, buttonSpace);

    colorPickerRendered = true;
  }

  buttonSpace.addEventListener("click", (event) => {
    const clickedClass = event.target.className;
    
    const isNotRow = clickedClass.split('').includes('x');
    if (!isNotRow) {
      return
    }

    const colorPicker = document.getElementById('colorPicker');
  
    const clickedElement = document.querySelector(`.${clickedClass}`)
    const buttonBackColor = clickedElement.style.backgroundColor;
  
    clickedElement.style.backgroundColor = `${colorPicker.value}`;
  });
}