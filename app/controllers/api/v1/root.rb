module Api
    module V1
      class Root < Grape::API
        mount Api::V1::Zones
      end
    end
  end