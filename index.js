const buttonSpace = document.querySelector(".butMania");

const colorArray = [
  'white',
  'black',
  'red',
  'green'
];

let one = true;
let two = true;
let three = true;
let four = true;

let colorOne = "white";
let colorTwo = "white";
let colorThree = "white";
let colorFour = "white";

/**function renderButtons(pOne = colorOne, pTwo = colorTwo, pThree = colorThree, pFour = colorFour) {
  buttonSpace.innerHTML = `
  <div>
    <button class="butOneRowOne" style="background-color: ${pOne}"></button>
    <button class="butTwoRowOne" style="background-color: ${pTwo}"></button>
    <button class="butThreeRowOne" style="background-color: ${pThree}"></button>
    <button class="butFourRowOne" style="background-color: ${pFour}"></button>
  </div>
  <div>
    <button class="butOneRowTwo" style="background-color: ${pOne}"></button>
    <button class="butTwoRowTwo" style="background-color: ${pTwo}"></button>
    <button class="butThreeRowTwo" style="background-color: ${pThree}"></button>
    <button class="butFourRowTwo" style="background-color: ${pFour}"></button>
  </div>
  <div>
    <button class="butOneRowOne" style="background-color: ${pOne}"></button>
    <button class="butTwoRowOne" style="background-color: ${pTwo}"></button>
    <button class="butThreeRowOne" style="background-color: ${pThree}"></button>
    <button class="butFourRowOne" style="background-color: ${pFour}"></button>
  </div>
  <div>
    <button class="butOneRowTwo" style="background-color: ${pOne}"></button>
    <button class="butTwoRowTwo" style="background-color: ${pTwo}"></button>
    <button class="butThreeRowTwo" style="background-color: ${pThree}"></button>
    <button class="butFourRowTwo" style="background-color: ${pFour}"></button>
  </div>
  `;
}**/
  
let renderHtml = '';

function renderButtons(width, height, html, row = 1, column = 1) {
  if (row > height) {
    buttonSpace.innerHTML = html;
    return;
  }

  renderHtml = renderHtml.concat(`<div class="y${row}">`)
  while (column <= width) {
    renderHtml += `<button class="x${column}y${row}"></button>`
    column += 1;
  }
  renderHtml = renderHtml.concat('</div>')

  row += 1;
  renderButtons(width, height, renderHtml, row);
}
renderButtons(5, 3, renderHtml);

buttonSpace.addEventListener("click", (event) => {
  const clickedClass = event.target.className;
  const clickedElement = document.querySelector(`.${clickedClass}`)
  let buttonBackColor = clickedElement.style.backgroundColor;
  console.log('eventTarget:', event.target, 'clickedClass:', clickedClass, 'clickedElement:', clickedElement, 'buttonBackColor:', buttonBackColor);

  if (buttonBackColor && buttonBackColor === 'white') {
    buttonBackColor = 'black';
  } else {
    buttonBackColor = 'white';
  }
});