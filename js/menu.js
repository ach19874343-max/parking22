let btn = document.getElementById("menu-btn");
let menu = document.getElementById("side-menu");
let overlay = document.getElementById("menu-overlay");

btn.onclick=function(){

btn.classList.toggle("active");

if(menu.style.right==="0px"){
menu.style.right="-260px";
overlay.style.display="none";
}else{
menu.style.right="0";
overlay.style.display="block";
}

}

overlay.onclick=function(){

menu.style.right="-260px";
overlay.style.display="none";
btn.classList.remove("active");

}