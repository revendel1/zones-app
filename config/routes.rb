Rails.application.routes.draw do
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  mount Api::Root, at: "/"

  root "pages#index"
end
