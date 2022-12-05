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

  renderHtml.concat(`<div class="y${row}">`)
  while (column <= width) {
    renderHtml += `<button class="x${column}y${row}"></button>`
    column += 1;
  }
  renderHtml.concat('</div>')

  row += 1;

  console.log('html:', renderHtml, 'row:', row);
  renderButtons(width, height, renderHtml, row);
}
renderButtons(5, 3, renderHtml);

/**buttonSpace.addEventListener("click", (event) => {
  if (event.target.className === "butOneRowOne" || event.target.className === "butTwoRowTwo") {
    two = !two;
    two ? (colorTwo = "white") : (colorTwo = "black");
    renderButtons(colorOne, colorTwo);
  }
  if (event.target.className === "butTwoRowOne" || event.target.className === "butThreeRowTwo") {
    one = !one;
    three = !three;
    one ? (colorOne = 'white') : (colorOne = 'black');
    three ? (colorThree = 'white') : (colorThree = 'black');
    renderButtons(colorOne, colorTwo, colorThree);
  }
  if (event.target.className === "butThreeRowOne") {
    two = !two;
    four = !four;
    two ? (colorTwo = "white") : (colorTwo = "black");
    four ? (colorFour = 'white') : (colorFour = 'black');
    renderButtons(colorOne, colorTwo, colorThree, colorFour);
  }
  if (event.target.className === "butFourRowOne" || event.target.className === "butOneRowTwo") {
    three = !three;
    three ? (colorThree = 'white') : (colorThree = 'black');
    renderButtons(colorOne, colorTwo, colorThree);
  }
  if (event.target.className === "butFourRowTwo") {
    three = !three;
    three ? (colorThree = colorArray[Math.round(Math.random() * 4)]) : (colorThree = colorArray[Math.round(Math.random() * 2)]);
    renderButtons(colorOne, colorTwo, colorThree);
  }
});**/