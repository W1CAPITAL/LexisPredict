import {redirect} from "next/navigation";

/** Compatibilidade com o nome exibido no menu. O Superagente real usa /chat. */
export default function SuperagentePage(){
  redirect("/chat");
}
