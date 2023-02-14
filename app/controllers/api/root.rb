module Api
    class Root < Grape::API
      mount Api::V1::Root
    end
  end